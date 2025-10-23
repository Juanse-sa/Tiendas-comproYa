// Cargar .env de la raíz
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import morgan from "morgan";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const INTENTS = new Map();

app.post("/api/payments/intents", (req, res) => {
  const { amount } = req.body;
  const id = "pi_" + crypto.randomBytes(6).toString("hex");
  const intent = { id, amount, currency: "USD", status: "requires_confirmation" };
  INTENTS.set(id, intent);
  res.status(201).json(intent);
});

app.post("/api/payments/confirm", (req, res) => {
  const { id } = req.body;
  const intent = INTENTS.get(id);
  if (!intent) return res.status(404).json({ ok: false, error: "not_found" });
  intent.status = "succeeded";
  res.json(intent);
});

const PORT = Number(process.env.PAYMENTS_PORT || 8080);
app.listen(PORT, () => console.log(`💳 payments-adapter en :${PORT}`));
