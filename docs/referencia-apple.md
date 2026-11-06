# Referencia: lenguaje de movimiento de Apple (iPhone Air y iPhone 18 Pro)

Medido el 2026-11-05 con el navegador y con `craft-anything` 0.3.0 en modo clean room (solo lo que ve un visitante). Son patrones y medidas: no hay assets de Apple en este repo.

## Medidas (iPhone Air)
| Qué | Desktop (1440) | Móvil (390) |
|---|---|---|
| Alto de página | 33.281 px | 36.842 px |
| Padding vertical de sección | 160 px | 96 px |
| Columna de contenido | 1260 px máx. | 341 px |
| Columna de lectura | 760 px máx. | |

- **Radios:** 28 px en baldosas (99 usos), 980 px en píldoras, 50 % en círculos. Casi sin sombras.
- **Tipografía:** cuerpo 17 px; escala 12, 14, 17, 21, 24, 28, 40, 48 (80 en Pro). Pesos 400 (mayoría), 600, 500.
- **Tracking:** 80 px con -1.2 px (-0.015em); 56 px con -0.28 px; 48 px con -0.144 px. Line-height 1.05 a 1.08 en titulares.
- **Titular a dos tonos:** primera línea en color de texto, segunda en un gris tintado.

## Movimiento
- **Transición base:** `0.32s cubic-bezier(0.4, 0, 0.6, 1)` (167 usos). Entradas: `cubic-bezier(0.28, 0.11, 0.32, 1)`.
- **Hallazgo clave:** 16 videos, 0 canvas, 4 `data-anim-keyframe` en el HTML inicial. El efecto viene de video prerenderado que arranca en un punto del scroll, no de animar mucho el DOM.
- **Gramática de scroll observada:**
  - `{"start":"t - 70vh","cssClass":"animate"}`: clase que dispara una transición CSS.
  - `{"start":"a0t - 100vh","end":"a0t + 75vh","ease":0.3,"easeFunction":"easeInOutSin","scale":[1.2,1],"x":["-20px",0]}`: parallax suave con suavizado.
  - `"disabledWhen":["no-enhanced"]`: todo es mejora progresiva.

## Patrones que adoptamos
Una idea por pantalla; local nav sticky con CTA; galería con autoplay, píldora de progreso y play/pausa (modelo del HUD); "Take a closer look" (píldoras + objeto); sticky donde el objeto se aleja mientras entran datos; tabs bajo demos.

## Patrones que no adoptamos
Producto físico fotografiado (usamos video real de proyectos), 30.000 px de largo, sección clara (el tema es oscuro y único).
