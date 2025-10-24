// auth-service/server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// ============ ENV & PATH ============
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

// ============ APP ============
const app = express();

// ============ CORS ============
const ALLOWED_ORIGINS = [
  "https://storage.googleapis.com",
  // "https://tu-dominio.com",
];

app.use((req, res, next) => {
  res.setHeader("X-Service", "auth-service");
  next();
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // health/curl sin Origin
      return cb(null, ALLOWED_ORIGINS.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ============ DB ============
const usingSocket = !!process.env.INSTANCE_UNIX_SOCKET;

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,   // p.ej. "proyecto"
  process.env.MYSQL_USER,       // p.ej. "root"
  process.env.MYSQL_PASSWORD,   // p.ej. "5n$+|jd0+\\m%yZeU"
  {
    dialect: "mysql",
    logging: false,
    ...(usingSocket
      ? { dialectOptions: { socketPath: process.env.INSTANCE_UNIX_SOCKET } }
      : { host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306) }),
  }
);

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(200), allowNull: true },
    provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "local" },
    googleId: { type: DataTypes.STRING(64), allowNull: true },
  },
  { tableName: "users" }
);

// ============ JWT ============
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

// ============ Health ============
app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.json({ ok: true, via: "/health" }));
app.get("/api/auth/health", (_req, res) => res.json({ ok: true, via: "/api/auth/health" }));

// ============ ME ============
app.get("/me", mustAuth, async (req, res) => {
  const u = await User.findByPk(req.user.sub, { attributes: ["id", "name", "phone", "email", "provider"] });
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });
  res.json({ ok: true, user: u, via: "/me" });
});

app.get("/api/auth/me", mustAuth, async (req, res) => {
  const u = await User.findByPk(req.user.sub, { attributes: ["id", "name", "phone", "email", "provider"] });
  if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });
  res.json({ ok: true, user: u, via: "/api/auth/me" });
});

// ============ Registro/Login ============
app.post("/api/auth/register", async (req, res) => {
  try {
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
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  } catch (e) {
    console.error("❌ /api/auth/register error:", e?.message || e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
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
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  } catch (e) {
    console.error("❌ /api/auth/login error:", e?.message || e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ============ Google ============
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

app.post("/api/auth/google", async (req, res) => {
  if (!googleClient) return res.status(500).json({ ok: false, error: "google_not_configured" });
  const { id_token } = req.body || {};
  if (!id_token) return res.status(400).json({ ok: false, error: "missing_id_token" });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: id_token, audience: googleClientId });
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
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    });
  } catch (e) {
    console.error("❌ /api/auth/google error:", e?.message || e);
    res.status(401).json({ ok: false, error: "invalid_google_token" });
  }
});

// ============ Start ============
const PORT = Number(process.env.PORT || 8080);

// Arranque ordenado: primero DB (authenticate + sync), luego listen
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB conectada");

    // crea tablas si no existen (no destruye datos). Para dev puedes usar { alter: true }.
    await sequelize.sync();
    console.log("✅ Sequelize sync OK");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🧩 auth-service escuchando en :${PORT}`);
    });
  } catch (err) {
    console.error("❌ Error inicializando DB:", err?.message || err);
    // En Cloud Run conviene salir para que se reinicie el contenedor si no arranca bien
    process.exit(1);
  }
})();

process.on("SIGTERM", () => {
  console.log("Recibido SIGTERM, cerrando...");
  process.exit(0);
});
