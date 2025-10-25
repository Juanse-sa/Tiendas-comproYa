// inventory-service/server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { Sequelize, DataTypes } from "sequelize";

// === ENV solo en local (Cloud Run define K_SERVICE) ===
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.K_SERVICE) {
  // en local, carga .env de la carpeta del servicio o raíz como prefieras
  dotenv.config({ path: path.resolve(__dirname, ".env") });
  // si tu .env está en la raíz del monorepo:
  // dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// === DB: usa socket si INSTANCE_UNIX_SOCKET está definido ===
const usingSocket = !!process.env.INSTANCE_UNIX_SOCKET;

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,   // e.g. "proyecto" o "retailBD"
  process.env.MYSQL_USER,       // e.g. "root" o usuario app
  process.env.MYSQL_PASSWORD,   // tu contraseña
  {
    dialect: "mysql",
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    ...(usingSocket
      ? { dialectOptions: { socketPath: process.env.INSTANCE_UNIX_SOCKET } }
      : {
          host: process.env.MYSQL_HOST || "127.0.0.1",
          port: Number(process.env.MYSQL_PORT || 3306),
        }),
  }
);

// === Modelo ===
const Stock = sequelize.define(
  "Stock",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    store_id: { type: DataTypes.STRING(20), allowNull: false },
    sku: { type: DataTypes.STRING(50), allowNull: false },
    available: { type: DataTypes.INTEGER, defaultValue: 0 },
    reserved: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: "store_stock" }
);

// === Rutas ===

// ✅ Health check (para Cloud Run)
app.get("/api/inventory/health", (_req, res) =>
  res.json({ ok: true, via: "/api/inventory/health" })
);

// ✅ Cargar datos iniciales de prueba
app.post("/api/inventory/seed", async (_req, res) => {
  await Stock.bulkCreate(
    [
      { store_id: "S001", sku: "SKU-001", available: 10, reserved: 0 },
      { store_id: "S001", sku: "SKU-002", available: 5, reserved: 0 },
    ],
    { ignoreDuplicates: true }
  );
  res.json({ ok: true });
});

// ✅ Consultar inventario (opcionalmente filtrando por store o sku)
app.get("/api/inventory/stock", async (req, res) => {
  const { store, sku } = req.query;
  const where = {};
  if (store) where.store_id = store;
  if (sku) where.sku = sku;
  const rows = await Stock.findAll({ where });
  res.json(rows);
});

// ✅ Reservar stock
app.post("/api/inventory/reservations", async (req, res) => {
  const { store_id, sku, qty } = req.body;
  const row = await Stock.findOne({ where: { store_id, sku } });
  if (!row || row.available < qty)
    return res.status(409).json({ ok: false, reason: "no_stock" });
  row.available -= qty;
  row.reserved += qty;
  await row.save();
  res.status(201).json({ ok: true });
});

// ✅ Confirmar reserva
app.post("/api/inventory/confirm", async (req, res) => {
  const { store_id, sku, qty } = req.body;
  const row = await Stock.findOne({ where: { store_id, sku } });
  if (!row || row.reserved < qty)
    return res.status(409).json({ ok: false, reason: "no_reserved" });
  row.reserved -= qty;
  await row.save();
  res.json({ ok: true });
});

// 🆕 ✅ Agregar un nuevo producto al inventario
app.post("/api/inventory/add", async (req, res) => {
  try {
    const { store_id, sku, available = 0, reserved = 0 } = req.body;

    if (!store_id || !sku) {
      return res.status(400).json({
        ok: false,
        error: "store_id y sku son obligatorios"
      });
    }

    const existing = await Stock.findOne({ where: { store_id, sku } });
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: "El producto ya existe en esta tienda"
      });
    }

    const newItem = await Stock.create({ store_id, sku, available, reserved });
    res.status(201).json({ ok: true, item: newItem });
  } catch (err) {
    console.error("❌ Error agregando producto:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === Cloud Run: escuchar SIEMPRE en process.env.PORT (no 4002) ===
const PORT = Number(process.env.PORT || 8080);

// Arranca el servidor y luego inicializa DB en background (para no fallar healthcheck)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🏪 inventory-service escuchando en :${PORT}`);
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB conectada (inventory)");
    await sequelize.sync();
    console.log("✅ Sequelize sync OK (inventory)");
  } catch (e) {
    console.error("❌ Error arrancando inventory:", e?.message || e);
    // NO hacemos process.exit(1) en Cloud Run; deja el servicio arriba para poder inspeccionar /health
  }
})();
