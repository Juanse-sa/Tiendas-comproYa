# Etapa base: Node 18 estable (recomendada por Cloud Run)
FROM node:18-alpine

# Crear directorio de la app
WORKDIR /app

# Copiar package.json y package-lock.json primero (para cachear dependencias)
COPY package*.json ./

# Instalar dependencias (sin devDependencies)
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto que usará la app
ENV PORT=8080
EXPOSE 8080

# Cambiamos el puerto interno si tu código usa INVENTORY_PORT
# Cloud Run inyecta PORT=8080, así que forzamos ese valor
ENV INVENTORY_PORT=8080

# Comando de arranque
CMD ["npm", "start"]
