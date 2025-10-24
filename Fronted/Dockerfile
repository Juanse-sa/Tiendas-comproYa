# ==================================
# ETAPA 1: BUILD (Compilación del código)
# ==================================
FROM node:lts-alpine as builder
WORKDIR /app

# Instala dependencias
COPY package*.json ./
RUN npm install

# Copia todo el código fuente del frontend y compila
COPY . .
RUN npm run build  # Este comando genera la carpeta de salida (ej. /app/dist)

# ==================================
# ETAPA 2: RUN (Servicio de archivos estáticos)
# ==================================
FROM nginx:alpine
# Mapea el puerto 80 del contenedor al 8080 que Cloud Run requiere
EXPOSE 8080

# Quita el archivo de configuración por defecto de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Agrega tu propia configuración de Nginx (si es necesario para routing SPA)
# Opcional: COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia los archivos compilados de la etapa "builder"
# La carpeta "dist" contendrá TUS CUATRO VISTAS y todos los assets.
COPY --from=builder /app/dist /usr/share/nginx/html
