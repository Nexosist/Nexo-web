# NEXO Sistemas Constructivos

Sitio web de NEXO Sistemas Constructivos: construcción en seco y Steel Frame en Puerto Libertad, Misiones. Dirección oficial: https://www.nexosistemas.com.ar

Es un sitio estático: HTML, CSS y JavaScript, sin proceso de armado. Se publica con GitHub Pages (ver "Publicar en el dominio oficial").

## Páginas publicadas

- `index.html`: inicio. De arriba hacia abajo:
  - portada con el botón de contacto;
  - servicios (Steel Frame, tabiques y cielorrasos, molduras, remodelaciones, obras llave en mano, asesoramiento técnico y proyectos a medida);
  - "Cómo es por dentro": panel de Steel Frame, tabique de placas y cielorraso suspendido, cada uno con vista 3D y 2D;
  - "Qué se puede armar en seco": vivienda, ampliación, local comercial y oficinas, armados paso a paso en 3D y 2D;
  - "Cómo se colocan las placas": guía plegable con pestañas Pared y Cielorraso y dibujos esquemáticos;
  - "Qué gana una obra al construirse en seco": cinco comparaciones entre construcción en húmedo y en seco (plazos, agua y limpieza, peso, aislación, modificaciones);
  - llamado final a contactar.
- `nosotros.html`: quiénes somos y proceso de trabajo.
- `contacto.html`: ubicación, correo y WhatsApp (cada fila es un enlace), mapa de Google con el botón "Cómo llegar" y preguntas frecuentes.
- `404.html`: página para direcciones que no existen.
- `tarjeta-presentacion.html`: generador de tarjetas para imprimir, con código QR (`js/qrcode.js`).

El menú tiene Inicio, Nosotros y Contacto. Las páginas "Construcción en seco" y "Colocación de placas" se sacaron a pedido del cliente: su contenido pasó, resumido, al inicio.

## Solo en la computadora (no se publica)

Estos archivos quedan en la carpeta, pero `.gitignore` los excluye para que no se suban:

- `computo.html` y `js/computo.js`: cómputo orientativo de materiales con vista previa en 3D (modelo paramétrico `buildParam` en `js/viewer3d.js`). Es solo geometría; la estructura la calcula un profesional. No está enlazado desde ninguna página.
- `construccion-en-seco.html` y `colocacion-de-placas.html`: las dos páginas que se sacaron. Conservan la comparativa completa, las normas citadas y la guía completa.
- `seco-vs-humedo.html`: nombre anterior de `construccion-en-seco.html`; solo redirigía a ella.
- `herramientas/`: scripts y copias de respaldo (ver `herramientas/LEEME.txt`).
- Fotos y dibujos que ninguna página publicada usa hoy: `obra-steelframe.jpg`, `placas-apiladas.jpg`, `corte-placa.jpg`, `terminacion-pared.jpg` y `assets/images/2d/platea-*.webp`.

## Qué trae

- Modo claro y oscuro. La primera vez sigue la configuración del dispositivo y después recuerda la elección.
- Menú que se esconde al bajar y aparece al subir.
- Botón flotante de WhatsApp en todas las páginas.
- Animaciones al hacer scroll, que se desactivan si el dispositivo pide menos movimiento. El scroll es el del navegador.
- Para buscadores: título y descripción propios en cada página, dirección principal (canonical) apuntando al dominio oficial, datos para redes (Open Graph), datos estructurados del negocio, `sitemap.xml` y `robots.txt`.

## Estructura

```
index.html, nosotros.html, contacto.html, 404.html, tarjeta-presentacion.html
css/style.css            estilos, con los colores de ambos temas como variables
js/main.js               tema, menú, scroll, cambio de página, pestañas y guía
js/viewer3d.js           visor 3D (Three.js) de todas las escenas
js/qrcode.js             código QR de la tarjeta
assets/images/           logos, foto de portada e imagen para redes (og-image.jpg)
assets/images/2d/        imágenes de la vista 2D, un archivo por paso
assets/tex/              texturas de materiales para el 3D
assets/fonts/            tipografías Archivo y Source Sans 3
sitemap.xml, robots.txt
google24697fc7656fd0bd.html   verificación de Google Search Console
CNAME                    dominio oficial para GitHub Pages
```

## Ver el sitio en la computadora

```
python -m http.server 8000
```

y entrar a `http://localhost:8000`. Abrir `index.html` directo funciona, pero la navegación entre páginas y el 3D andan mejor con un servidor.

## Imágenes y materiales

- **Vista 3D:** modelos armados en JavaScript, con materiales de textura real (color, relieve y rugosidad) y luz de estudio. Hay tres calidades según el equipo; en los más básicos se usa un modo liviano sin texturas.
- **Vista 2D:** imágenes generadas por computadora, una por paso. Se renderizaron en Blender a partir de la misma geometría de los modelos 3D, con materiales de textura real y un cielo real. Los scripts de render no están en el repositorio.
- **Texturas** (licencia CC0, sin obligación de citar): chapa galvanizada Metal041A, hormigón Concrete034, revoque Plaster004, OSB Chipboard004, cerámico Tiles040 y la lana Carpet016, de [ambientCG](https://ambientcg.com); cielo HDRI kloofendal_48d_partly_cloudy_puresky de [Poly Haven](https://polyhaven.com).
- **Límites:** no existe una textura libre de lana de vidrio, así que se usó la de una alfombra fibrosa teñida de amarillo; se reemplazaría con una foto de lana de vidrio real. Los materiales son genéricos, no de productos de una marca. Son imágenes generadas por computadora, no fotos de obras de NEXO.
- **Fotos:** la foto de portada (`hero_steelframe.jpg`) es una foto libre de Pexels de una casa en obra con estructura de Steel Frame, pasada a gris oscuro. No es una obra de NEXO: conviene reemplazarla por fotos propias.

## Datos técnicos

- Las medidas de referencia de los modelos y de las leyendas salen de los manuales técnicos de Durlock (tomos 1 y 2) y de las fichas de Knauf Argentina (montante y solera de 70 mm, placa ST). De Placo solo se confirmó el peso de la placa estándar de 12,5 mm (8,3 kg/m²).
- Sin confirmar: el espesor de chapa de los perfiles de Knauf Argentina y las fichas de perfiles de Placo Argentina.
- Los textos de la comparativa no llevan porcentajes ni cifras, porque las fuentes del rubro no coinciden entre sí. Si se agregan datos, conviene citar la fuente.
- La guía de colocación es orientativa: sus cifras vienen de guías de instalación publicadas y pueden cambiar según el producto. Antes de pasar a la oficial conviene que el cliente la revise.
- Las normas citadas en `construccion-en-seco.html` (versión solo local) son: reglamento CIRSOC 303, edición julio 2009; Resolución 5-E/2018; IRAM 51001-1; IRAM 11643, 11644, 11645 y 11910-3. Si esa página vuelve a publicarse, confirmar la versión vigente de cada una.

## Visor 3D (`js/viewer3d.js`)

- Usa Three.js r128 desde cdnjs, con firma de seguridad. Se descarga solo cuando una escena está por verse.
- Ajusta la calidad al equipo (alta, media o baja), limita cuadros por segundo y resolución, y libera la memoria de video de los visores que quedan lejos de la pantalla. Si no hay WebGL, o el equipo va lento, quedan las imágenes 2D.
- Para probar una calidad se agrega a la dirección `?gl=low`, `?gl=mid` o `?gl=high`; con `?gl=off` se ve solo el 2D.
- Al tocar una pieza, sale de su lugar, se pinta de azul y aparece su nombre y para qué sirve (objeto `LABELS`). Hay botón de capas, pantalla completa con la ficha del paso, y "separar las capas", que se apaga solo al cambiar de paso.
- Las texturas se piden desde `assets/tex/` solo cuando se abre un 3D; si alguna no carga, queda la textura simple.

## Búsqueda en Google

- Propiedad en Google Search Console: `https://www.nexosistemas.com.ar` (prefijo de URL), verificada con el archivo `google24697fc7656fd0bd.html`, que tiene que estar en la raíz del sitio.
- Después de publicar: en Search Console apretar "Verificar" y cargar `sitemap.xml` en "Sitemaps". Google puede tardar unos días en indexar.
- Revisar que `nexosistemas.com.ar` (sin www) redirija a la versión con www, así Google no los trate como dos sitios.

## Publicar en el dominio oficial

El sitio oficial se publica con GitHub Pages y sube **todo el repositorio** (`.github/workflows/deploy.yml`, `path: '.'`) cada vez que se hace push a `main`. Por eso `.gitignore` excluye lo que no debe publicarse.

1. Actualizar los números de versión: `python herramientas/estampar-versiones.py`.
2. Ver qué se subiría, sin agregar nada: `git add -n -A .`. Tiene que aparecer solo lo listado en "Páginas publicadas" y "Estructura", y nada de "Solo en la computadora".
3. Hacer el commit y el push a `main`.
4. Comprobar que `https://www.nexosistemas.com.ar/google24697fc7656fd0bd.html` abre.
5. En Search Console: Verificar y cargar `sitemap.xml`.

## Web de prueba (Vercel)

https://nexo-web-prueba.vercel.app es una copia con `noindex` (encabezado `X-Robots-Tag` y `robots.txt` que bloquea), para que el cliente la vea sin que aparezca en Google. Esa protección no se lleva al sitio oficial. No lleva el cómputo ni las dos páginas sacadas.

## Pendientes con el cliente

- Reemplazar la foto de portada por fotos propias.
- Confirmar qué marcas de placas y perfiles usan realmente y el espesor de chapa de los perfiles.
- Si se quiere mostrar lana de vidrio real, sumar una foto cercana.
- Revisar la guía de colocación y confirmar si el cómputo se publica.

© 2026 NEXO Sistemas Constructivos. Todos los derechos reservados.
