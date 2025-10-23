// .env raíz
import path from "path"; import { fileURLToPath } from "url"; import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express"; import cors from "cors"; import morgan from "morgan"; import fetch from "node-fetch";
const app = express(); app.use(cors()); app.use(express.json()); app.use(morgan("dev"));

const CARTS = new Map();
const getUser = (req) => req.header("x-user") || "guest";
const PRICING = `http://localhost:${Number(process.env.PRICING_PORT || 4003)}`;

app.post("/api/cart/items", async (req, res) => {
  const { sku, qty } = req.body;
  const r = await fetch(`${PRICING}/api/pricing/price?sku=${encodeURIComponent(sku)}`);
  if (!r.ok) return res.status(400).json({ ok:false, reason:"no_price" });
  const { price } = await r.json();

  const user = getUser(req);
  const cart = CARTS.get(user) || { items: [], total: 0 };
  const existing = cart.items.find(i => i.sku === sku);
  if (existing) existing.qty += qty; else cart.items.push({ sku, qty, price });
  cart.total = cart.items.reduce((s, i) => s + i.qty * i.price, 0);
  delete cart.final; delete cart.coupon;
  CARTS.set(user, cart);
  res.status(201).json(cart);
});

app.post("/api/cart/apply-coupon", async (req, res) => {
  const user = getUser(req);
  const cart = CARTS.get(user);
  if (!cart) return res.status(404).json({ ok:false, reason:"empty" });

  const r = await fetch(`${PRICING}/api/pricing/coupons/validate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: req.body.code, itemsTotal: cart.total })
  });
  const data = await r.json();
  if (!data.valid) return res.json({ ok:false, reason:"invalid_coupon" });

  cart.coupon = { code: req.body.code, discount: data.discount };
  cart.final = data.final;
  CARTS.set(user, cart);
  res.json(cart);
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => console.log(`🧩 cart-service en :${PORT}`));

