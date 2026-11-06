# Renzo Payero: portfolio "Go-live"

La página se construye sola, como se entrega un proyecto real: un equipo de agentes orbita el cursor del visitante, sale a relevar, escribir, diseñar, verificar y publicar cada sección, y vuelve. Al terminar, el neón se enciende (el go-live) y queda una página calma, con el lenguaje de movimiento de Apple y los colores de Odoo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo en `localhost:4321` |
| `npm run build` | Sitio estático en `dist/` |
| `npm run check` | Tipos de Astro y TypeScript |
| `npm test` | Matriz de pruebas (Playwright): Chromium, Firefox y WebKit a varios anchos |
| `docker compose up -d --build` | Imagen de producción en `localhost:8080` |

Parámetros útiles en la URL: `?build=1` fuerza el build y `?build=0` muestra la página final.

## Cómo está armado

- **Contenido real en el HTML.** Astro genera todo estático. Sin JS o con `prefers-reduced-motion` se ve la página final; la animación es una capa encima.
- **`src/swarm/`: el enjambre.** Física de órbita en 3D, inspección de elementos y canvas. Sin dependencias: se carga también en visitas repetidas.
- **`src/build-engine/`: el motor de build.** Timelines de GSAP por sección, que piden agentes prestados al enjambre. Solo se descarga en la primera visita.
- **`src/motion/`: el movimiento de la página.** Revelado por clase a 70vh, galería, telemetría. Las escenas atadas al scroll son CSS scroll-driven: corren sin JS y fuera del hilo principal.
- **`integrations/`:** datos reales del build para "Cómo se hizo" y CSP con el hash exacto de cada script inline.

## Generar los assets

Salvo el video grabado, todo se versiona ya generado. Hay que correr estos scripts solo si cambia lo que representan:

```sh
node scripts/gen-hero-name.mjs              # contornos del nombre, con las métricas reales de Inter
node scripts/gen-portrait.mjs <foto>        # recorte y duotono ciruela del retrato
node scripts/record-projects.mjs [slug]     # graba los proyectos cuadro a cuadro (solo navega y scrollea)
node scripts/record-projects.mjs --phone    # versión móvil para el dispositivo
node scripts/render-device.mjs              # prerender del dispositivo con Three.js (usa la GPU)
node scripts/gen-og.mjs                     # imágenes para compartir
```

## Desplegar

```sh
SITE_URL=https://tu-dominio.com BUILD_COMMITS=$(git rev-list --count HEAD) docker compose up -d --build
```

Sin `SITE_URL` el sitio funciona igual, pero sin URLs absolutas (`canonical`, `hreflang`, `og:image`) ni sitemap. El contenedor sirve archivos con nginx sin root, en sistema de archivos de solo lectura. Detrás de un proxy, reemplazá `network_mode: bridge` por la red del proxy en `docker-compose.yml`.

## Decisiones

- **Color:** ciruela `#714B67` y gris `#8F8F8F` de Odoo, sin secundario teal. `#714B67` da 2.8:1 sobre el fondo, así que nunca es texto: el contorno claro define la letra.
- **Tipografía:** Inter (la oficial de Odoo y lo más cercano libre a SF Pro), Geist Mono en herramientas.
- **Sin ClientRouter:** view transitions nativas entre documentos, más simple y compatible con CSP.
- **Video prerenderado en lugar de WebGL en vivo:** como Apple. Sin costo de GPU para el visitante.
- **Referencias:** medidas de Apple en `docs/referencia-apple.md`, skills usadas en `docs/skills.md`.
