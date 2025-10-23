# Imagen base oficial de Node.js
FROM node:18

# Crea un directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias primero (para aprovechar la caché de Docker)
COPY package*.json ./

# Instala las dependencias
RUN npm install --omit=dev

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto que usa tu app (coincide con el puerto de Cloud Run)
EXPOSE 8080

# Define la variable de entorno PORT (Cloud Run la usa para enrutar el tráfico)
ENV PORT=8080

# Comando de inicio
CMD ["npm", "start"]
