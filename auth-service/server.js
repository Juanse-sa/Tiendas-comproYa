// auth-service/server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Carga .env desde el raíz del monorepo (Retail/.env)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan("dev"));

// ====== DB ======
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: false
  }
);

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(200), allowNull: true },
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "local" },
  googleId: { type: DataTypes.STRING(64), allowNull: true }
}, { tableName: "users" });

// ====== JWT ======
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const signToken = (u) =>
  jwt.sign({ sub: u.id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: "2h" });

const mustAuth = (req, res, next) => {
  const h = req.header("Authorization");
  if (!h || !h.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "no_token" });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
};

// --- HEALTH en ambas rutas (para cubrir proxys que quitan o no el prefijo) ---
app.get("/health", (_req, res) => res.json({ ok: true, via: "/health" }));
app.get("/api/auth/health", (_req, res) => res.json({ ok: true, via: "/api/auth/health" }));

// --- ME en ambas rutas (si el proxy quitara el prefijo) ---
app.get("/me", mustAuth, async (req, res) => {
  const u = await User.findByPk(req.user.sub, { attributes:["id","name","phone","email","provider"] });
  if (!u) return res.status(404).json({ ok:false, error:"user_not_found" });
  res.json({ ok:true, user:u, via:"/me" });
});
app.get("/api/auth/me", mustAuth, async (req, res) => {
  const u = await User.findByPk(req.user.sub, { attributes:["id","name","phone","email","provider"] });
  if (!u) return res.status(404).json({ ok:false, error:"user_not_found" });
  res.json({ ok:true, user:u, via:"/api/auth/me" });
});

// ====== Registro ======
app.post("/api/auth/register", async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }
  const exists = await User.findOne({ where: { email } });
  if (exists) return res.status(409).json({ ok: false, error: "email_in_use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, phone, email, passwordHash, provider: "local" });
  const token = signToken(user);
  res.status(201).json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, phone: user.phone, email: user.email }
  });
});

// ====== Login ======
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }
  const user = await User.findOne({ where: { email, provider: "local" } });
  if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  const token = signToken(user);
  res.json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, phone: user.phone, email: user.email }
  });
});

// ====== Google ======
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
app.post("/api/auth/google", async (req, res) => {
  const { id_token } = req.body || {};
  if (!id_token) return res.status(400).json({ ok: false, error: "missing_id_token" });
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || email;
    const googleId = payload.sub;

    let user = await User.findOne({ where: { email } });
    if (!user) user = await User.create({ name, phone: "-", email, provider: "google", googleId });

    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email }
    });
  } catch (e) {
    res.status(401).json({ ok: false, error: "invalid_google_token" });
  }
});

// ====== Me ======
app.get("/api/auth/me", mustAuth, async (req, res) => {
  const u = await User.findByPk(req.user.sub, {
    attributes: ["id", "name", "phone", "email", "provider"]
  });
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });
  res.json({ ok: true, user: u });
});

// ====== Start ======
const PORT = process.env.PORT || 8080;
(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(PORT, () => console.log(`🔐 auth-service en :${PORT}`));
})();
