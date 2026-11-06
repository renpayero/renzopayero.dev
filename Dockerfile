# syntax=docker/dockerfile:1

# Etapa de build: genera el sitio estático. Las dependencias de desarrollo no llegan a la imagen final.
FROM node:24-alpine AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# Sin scripts de instalación: los binarios nativos vienen precompilados y nada más los necesita acá.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# El dominio se decide al desplegar. Sin SITE_URL el sitio funciona igual, sin URLs absolutas ni sitemap.
ARG SITE_URL=""
# .git no entra en la imagen: los datos reales de "Cómo se hizo" se pasan como argumentos.
ARG BUILD_COMMITS=""
ENV SITE_URL=$SITE_URL BUILD_COMMITS=$BUILD_COMMITS
RUN npm run build

# Etapa final: solo nginx y los archivos. Corre sin root, en el puerto 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS site
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1
