# Usa una imagen oficial de Node.js
FROM node:18-alpine

# Crea el directorio de la app
WORKDIR /usr/src/app

# Copia los archivos de dependencias primero
COPY package*.json ./

# Instala solo las dependencias necesarias
RUN npm install --production

# Copia el resto del código
COPY . .

# Expone el puerto 8080 (Cloud Run lo requiere)
EXPOSE 8080

# Variable de entorno por defecto (puedes cambiarla en Cloud Run)
ENV PORT=8080

# Comando de inicio
CMD ["node", "server.js"]

