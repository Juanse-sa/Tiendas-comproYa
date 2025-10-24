// catalogo_service/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config(); // Lee catalogo_service/.env si existe

// ---- CORS (poner esto ARRIBA, antes de tus rutas) ----
import cors from "cors";

// Orígenes permitidos (tu front sale desde storage.googleapis.com)
const ALLOWED_ORIGINS = [
  "https://storage.googleapis.com",
  // si usas otro dominio para el front, agrégalo aquí:
  // "https://tu-dominio.com"
  "https://storage.googleapis.com/red-bruin-469518-f3-frontend/home%20(1).html"
];

app.use((req, res, next) => {
  // útil para depurar en Cloud Run
  res.setHeader("X-Service", "auth-service"); 
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    // peticiones sin "origin" (curl/health) también se permiten
    if (!origin) return cb(null, true);
    return cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  // NO uses credentials a menos que envíes cookies (no es tu caso)
  credentials: false,
  maxAge: 86400, // cachea preflight 1 día
}));

// Responder preflight explícitamente
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).send("");
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ======== CONFIG DB (acepta tu esquema MYSQL_*) ========
const DB = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "retailBD",
};

let pool = null;
let dbReady = false;
let queryUsed = null;

// Intentos de query (detecta tu tabla/columnas y hace alias a lo que espera el front)
const CANDIDATE_QUERIES = [
  // 1) tal cual mi ejemplo
  `SELECT id_producto, nom_producto, pre_producto, cat_producto, imagen FROM productos`,
  // 2) nombres "comunes"
  `SELECT id      AS id_producto,
          nombre  AS nom_producto,
          precio  AS pre_producto,
          categoria AS cat_producto,
          imagen
   FROM productos`,
  // 3) singular
  `SELECT id      AS id_producto,
          nombre  AS nom_producto,
          precio  AS pre_producto,
          categoria AS cat_producto,
          imagen
   FROM producto`,
  // 4) otros nombres posibles
  `SELECT id      AS id_producto,
          title   AS nom_producto,
          price   AS pre_producto,
          category AS cat_producto,
          image   AS imagen
   FROM productos`,
  // 5) último recurso: categorías/tabla "items"
  `SELECT id      AS id_producto,
          nombre  AS nom_producto,
          precio  AS pre_producto,
          categoria AS cat_producto,
          imagen
   FROM items`,
];

async function initDB() {
  try {
    pool = mysql.createPool({
      host: DB.host,
      port: DB.port,
      user: DB.user,
      password: DB.password,
      database: DB.database,
      waitForConnections: true,
      connectionLimit: 5,
      timezone: "Z"
    });

    // Detecta qué SELECT funciona
    for (const q of CANDIDATE_QUERIES) {
      try {
        const [rows] = await pool.query(q + " LIMIT 1");
        if (Array.isArray(rows)) {
          queryUsed = q; // ¡Ruta encontrada!
          break;
        }
      } catch (_) {
        // probar el siguiente
      }
    }

    if (!queryUsed) {
      console.warn("⚠️  No se encontró una tabla compatible. Se usará MOCK.");
      dbReady = false;
    } else {
      console.log("✅ Catálogo leerá con query:", oneLine(queryUsed));
      dbReady = true;
    }
  } catch (err) {
    console.error("❌ Error creando pool MySQL:", err.message);
    dbReady = false;
  }
}

const oneLine = (s) => s.replace(/\s+/g, " ").trim();

// ======== MOCK (si no hay DB compatible) ========
const mockProducts = [
  { id_producto: 1, nom_producto: "Televisor 50\"", pre_producto: 1499000, cat_producto: "Electrodomésticos", imagen: "/uploads/tv.jpg" },
  { id_producto: 2, nom_producto: "Cafetera",       pre_producto: 189000,  cat_producto: "Hogar",              imagen: "/uploads/cafetera.jpg" },
  { id_producto: 3, nom_producto: "Camiseta básica", pre_producto: 35000,   cat_producto: "Ropa",               imagen: "/uploads/shirt.jpg" },
  { id_producto: 4, nom_producto: "Pizza familiar",  pre_producto: 45000,   cat_producto: "Comida",             imagen: "/uploads/pizza.jpg" }
];

// ======== Static de imágenes ========
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// ======== Health/diagnóstico ========
app.get("/health", async (_req, res) => {
  res.json({
    ok: true,
    db: dbReady ? "ok" : "mock",
    mysql: { ...DB, password: DB.password ? "****" : "" },
    queryUsed: queryUsed ? oneLine(queryUsed) : null,
    time: new Date().toISOString()
  });
});

// ======== API principal que espera el gateway/front ========
app.get("/api/catalog", async (_req, res) => {
  try {
    if (dbReady && pool && queryUsed) {
      const [rows] = await pool.query(queryUsed);
      return res.json(rows);
    }
    return res.json(mockProducts);
  } catch (e) {
    console.error("Error /api/catalog:", e.message);
    res.status(500).json({ message: "Error al leer catálogo" });
  }
});

// (opcionales por si accedes directo)
app.get("/catalog", (req, res) => res.json(mockProducts));
app.get("/productos", (req, res) => res.json(mockProducts));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`📦 Catalog en :${PORT}`));

// Inicializa
initDB();
