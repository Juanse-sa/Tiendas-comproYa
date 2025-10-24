// Cargar .env de la raíz
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const WALLET = new Map();
// Cupón precargado para pruebas
WALLET.set("guest", [{ code: "SAVE10", status: "active", expiresAt: "2025-12-31" }]);
WALLET.set("jp",    [{ code: "SAVE10", status: "active", expiresAt: "2025-12-31" }]);

app.get("/api/wallet", (req, res) => {
  const user = req.header("x-user") || "guest";
  res.json({ coupons: WALLET.get(user) || [] });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`🧩 <nombre-servicio> en :${PORT}`));

