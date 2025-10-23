# ================================
# Etapa 1: Construcción del contenedor
# ================================
FROM node:18

# Crea la carpeta donde vivirá tu app dentro del contenedor
WORKDIR /app

# Copia los archivos necesarios de dependencias
COPY package*.json ./

# Instala las dependencias (sin devDependencies para producción)
RUN npm install --omit=dev

# Copia el resto del código fuente
COPY . .

# Expón el puerto que usará el servicio (Cloud Run usa el 8080)
EXPOSE 8080

# Define el puerto de ejecución esperado por Cloud Run
ENV PORT=8080

# Comando de inicio del servidor
CMD ["npm", "start"]
