# Imagen base ligera de Node.js
FROM node:18-alpine

# Crear directorio de la app
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar dependencias sin las de desarrollo
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Cloud Run define PORT=8080 automáticamente
ENV PORT=8080
EXPOSE 8080

# Comando de inicio
CMD ["npm", "start"]
