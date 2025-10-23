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

# Configurar variables de entorno y puerto

EXPOSE 8080

# Comando de inicio
CMD ["node", "server.js"]
