# Imagen ligera y estable
FROM node:20-alpine

# Crea directorio de trabajo
WORKDIR /app

# Copia manifiestos primero para aprovechar la cache de Docker
COPY package*.json ./

# Instala dependencias (solo producción)
RUN npm ci --omit=dev

# Copia el código
COPY server.js ./ 

# Define entorno de prod (opcional) y PORT por defecto 8080 (Cloud Run)
ENV NODE_ENV=production
ENV PORT=8080

# Expone el puerto (informativo para Docker/Compose)
EXPOSE 8080

# Comando de arranque
CMD ["npm", "start"]
