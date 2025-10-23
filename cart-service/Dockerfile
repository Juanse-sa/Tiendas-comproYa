# Usa una imagen base de Node.js ligera
FROM node:18-alpine

# Crea y define el directorio de trabajo
WORKDIR /app

# Copia los archivos de configuración primero (para usar la cache)
COPY package*.json ./

# Instala las dependencias de producción
RUN npm install --production

# Copia el resto del código
COPY . .

# Expone el puerto que usará Cloud Run
EXPOSE 8080

# Comando para ejecutar el servicio
CMD ["npm", "start"]
