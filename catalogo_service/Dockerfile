# Usar Node.js 18
FROM node:18

# Crear directorio de la app
WORKDIR /app

# Copiar package.json y package-lock.json si existe
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar todo el código
COPY . .

# Exponer el puerto que usará Cloud Run
EXPOSE 8080

# Comando de inicio (usar el puerto asignado por Cloud Run)
CMD ["sh", "-c", "node server.js"]


