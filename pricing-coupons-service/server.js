// server.js (ESM)
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Carga variables de entorno (si existe .env en el root del proyecto)
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ====== Mock data ======
const PRICES = new Map([
  ["SKU-001", 100],
  ["SKU-002", 50],
]);

const COUPONS = {
  SAVE10: { type: "percent", value: 10, active: true },
};

// ====== Endpoints ======
app.get("/api/pricing/price", (req, res) => {
  const sku = (req.query.sku || "").toString();
  const p = PRICES.get(sku);
  if (p == null) return res.status(404).json({ ok: false, reason: "no_price" });
  res.json({ ok: true, sku, price: p });
});

app.post("/api/pricing/coupons/validate", (req, res) => {
  const { code, itemsTotal } = req.body || {};
  const c = COUPONS[code];
  if (!c || !c.active) return res.json({ valid: false, reason: "invalid" });

  const total = Number(itemsTotal || 0);
  const discount = (total * c.value) / 100;
  res.json({ valid: true, discount, final: Math.max(0, total - discount) });
});

// IMPORTANTE: escuchar en PORT (Cloud Run usa PORT=8080)
const PORT = Number(process.env.PORT || process.env.PRICING_PORT || 4003);
app.listen(PORT, () => {
  console.log(`💰 pricing-coupons-service escuchando en :${PORT}`);
});
