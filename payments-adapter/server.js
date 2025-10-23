// payments-adapter/server.js

// (Opcional para local) Cargar .env
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

import express from "express";
import cors from "cors";
import morgan from "morgan";
import crypto from "crypto";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan("dev"));

// Health checks
app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.json({ ok: true, service: "payments-adapter" }));

// In-memory payment intents
const INTENTS = new Map();

app.post("/api/payments/intents", (req, res) => {
  const { amount } = req.body || {};
  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: "missing_or_invalid_amount" });
  }

  const id = "pi_" + crypto.randomBytes(6).toString("hex");
  const intent = {
    id,
    amount: Number(amount),
    currency: "USD",
    status: "requires_confirmation",
    createdAt: new Date().toISOString()
  };
  INTENTS.set(id, intent);
  res.status(201).json(intent);
});

app.post("/api/payments/confirm", (req, res) => {
  const { id } = req.body || {};
  const intent = id && INTENTS.get(id);
  if (!intent) return res.status(404).json({ ok: false, error: "not_found" });

  intent.status = "succeeded";
  intent.confirmedAt = new Date().toISOString();
  res.json(intent);
});

// Start server
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🧩 payments-adapter escuchando en :${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Recibido SIGTERM, cerrando payments-adapter...");
  process.exit(0);
});
