# Usa una imagen base ligera de Node.js (versión 18 es estable y reciente)
FROM node:18-alpine

# Crea el directorio de trabajo para la aplicación dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de manifiesto de dependencias
COPY package.json package-lock.json ./

# Instala las dependencias de producción. 
# El flag --omit=dev asegura que solo se instalen las dependencias necesarias.
RUN npm install --omit=dev

# Copia el resto del código fuente de la aplicación al directorio de trabajo
COPY . .

# Cloud Run automáticamente inyectará la variable PORT.
# EXPOSE es opcional pero buena práctica para documentación.
EXPOSE 8080

# Comando de inicio del contenedor. 
# El archivo de inicio debe ser 'server.js', que es donde está la lógica.
# Usamos 'npm start' para aprovechar el script definido en package.json (donde es 'node server.js')
CMD [ "npm", "start" ]
