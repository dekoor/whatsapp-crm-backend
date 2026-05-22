# Engine compartido de invitaciones

Esta carpeta contiene el "motor" que comparten todas las plantillas
de invitación en `app/public/templates/<plantilla>/`. La idea: arreglar un bug del
editor o agregar una sección al wizard implica tocar **un solo
archivo aquí**, no replicar el cambio en cada plantilla.

## Estructura

```
app/public/templates/
├── _shared/
│   ├── core.css          ← editor, customizer drawer, brushes,
│   │                       partículas, reveal, scroll-pause, layout
│   │                       estructural — todo lo que NO es paleta
│   ├── core.js           ← runtime completo. Lee namespace de
│   │                       <body data-template-id="...">
│   ├── assets/           ← logos genéricos (Instagram, WhatsApp)
│   └── README.md         ← este archivo
│
├── valentina-xv/        ← plantilla 1: Valentina (neon luxury urbano)
│   ├── index.html       ← carga ../_shared/core.{css,js} + ./skin.css
│   ├── skin.css         ← :root tokens + estilos por sección
│   └── assets/          ← fotos específicas de esta quinceañera
│
└── valeria-xv/          ← plantilla 2: Valeria (romántico floral lavanda)
    ├── index.html
    ├── skin.css
    └── assets/
```

## Reglas de oro

| Cambio | Dónde tocar |
|---|---|
| Bug en el editor (5 taps, drag, pinch) | `_shared/core.css` y/o `_shared/core.js` |
| Nuevo paso del wizard del customizer | `_shared/core.js` + un fieldset en cada `index.html` |
| Performance del scroll, animaciones globales | `_shared/core.css` |
| Cambiar tipografías o paleta de UNA plantilla | `<plantilla>/skin.css` |
| Cambiar la foto de portada de UNA plantilla | `<plantilla>/assets/portada.webp` |
| Agregar/quitar una sección entera | el `index.html` de la(s) plantilla(s) que lo necesite |
| Logo de Instagram/WhatsApp (genérico) | `_shared/assets/` |

## Cómo arrancar una nueva plantilla

```bash
cp -r app/public/templates/valentina-xv app/public/templates/<nuevo-id>
```

Después en el nuevo `index.html`:

1. Cambiar `<body data-template-id="xv">` a `xv-N`. Esto separa las
   claves de `localStorage` para que las dos plantillas no se pisen
   al guardar posiciones, fotos editadas, preferencias de música, etc.
2. Editar `skin.css` con la nueva paleta.
3. Reemplazar las fotos en `assets/` (mantén los nombres:
   `portada.webp`, `galeria-1..4.webp`, `regalos.webp`,
   `despedida.webp`).

Los refs a `../_shared/core.css`, `../_shared/core.js` y los logos
genéricos en `../_shared/assets/` siguen funcionando porque la ruta
relativa es siempre la misma.

## Namespace de localStorage

Cada plantilla guarda preferencias del usuario (posiciones de los
elementos arrastrados en modo editor, fotos cambiadas, datos del
formulario, preferencia de música) bajo un prefijo único:

```
inv-<template-id>:pos:<elemento>     ← posición y escala
inv-<template-id>:photo:<slot>       ← foto reemplazada (data URL)
inv-<template-id>:sound              ← on/off de música de fondo
inv-<template-id>:cust               ← JSON con los datos del form
```

El `template-id` se lee de `document.body.dataset.templateId`. El
default `"xv"` preserva las claves originales de la primera
invitación.

## Cache buster

Los refs a `core.css`, `core.js`, `skin.css` llevan `?b=YYYYMMDD<letra>`.
Cada vez que modifiques alguno, incrementa la letra (o el día) en
los `index.html` que lo usen para forzar al navegador a re-descargar.

## Consumir el engine desde otro proyecto / otro repo

`_shared/` está pensado para servirse como CDN: cualquier otro proyecto
(en este repo o en otro repo público de GitHub) puede consumir el
mismo `core.css` y `core.js`, y todo lo que cambies aquí se propaga
automáticamente al pushear.

### Para development (cambios al instante)

Usa **raw.githack.com** que tiene caché muy corto:

```html
<link rel="stylesheet" href="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/core.css">
<script src="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/core.js" defer></script>
```

### Para producción (estable, global, rápido)

Usa **jsDelivr** apuntando a un tag de versión, no a la rama:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dekoor/whatsapp-crm-backend@v1.0.0/web/_shared/core.css">
<script src="https://cdn.jsdelivr.net/gh/dekoor/whatsapp-crm-backend@v1.0.0/web/_shared/core.js" defer></script>
```

Para crear un tag de versión cuando quieras estabilizar:

```bash
git tag v1.0.0
git push origin v1.0.0
```

jsDelivr cachea agresivo (12h+), así que tag por tag das saltos
conscientes — el otro proyecto sube su ref al nuevo tag cuando esté
listo, no antes.

### Logos genéricos (Instagram, WhatsApp)

```html
<img src="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/assets/instagram.webp">
<img src="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/assets/whatsapp.webp">
```

### HTML mínimo para una plantilla nueva en otro repo

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mi nueva plantilla XV</title>

    <!-- Engine compartido -->
    <link rel="stylesheet"
          href="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/core.css">
    <!-- Tu skin propio -->
    <link rel="stylesheet" href="./skin.css">
  </head>
  <body data-template-id="mi-plantilla">
    <!-- Misma estructura de secciones que invitacion-xv/index.html -->

    <script src="https://raw.githack.com/dekoor/whatsapp-crm-backend/claude/hola-Du3ts/web/_shared/core.js"
            defer></script>
  </body>
</html>
```

El `data-template-id` único asegura que el localStorage de cada
plantilla no se pise.
