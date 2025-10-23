# auth-service/Dockerfile
FROM node:20

# Crea el directorio de la app
WORKDIR /usr/src/app

# Copia package.json y package-lock.json (si existe)
COPY package*.json ./

# Instala dependencias
RUN npm install --production

# Copia el resto del código
COPY . .

# Expone el puerto que usa el servicio
EXPOSE 4010

# Comando para ejecutar el servidor
CMD ["node", "server.js"]
