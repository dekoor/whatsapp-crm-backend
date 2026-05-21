# Engine compartido de invitaciones

Esta carpeta contiene el "motor" que comparten todas las plantillas
de invitación en `web/invitacion-*/`. La idea: arreglar un bug del
editor o agregar una sección al wizard implica tocar **un solo
archivo aquí**, no replicar el cambio en cada plantilla.

## Estructura

```
web/
├── _shared/
│   ├── core.css          ← editor, customizer drawer, brushes,
│   │                       partículas, reveal, scroll-pause, layout
│   │                       estructural — todo lo que NO es paleta
│   ├── core.js           ← runtime completo. Lee namespace de
│   │                       <body data-template-id="...">
│   ├── assets/           ← logos genéricos (Instagram, WhatsApp)
│   └── README.md         ← este archivo
│
├── invitacion-xv/        ← plantilla 1: Valentina Sofía (oscura)
│   ├── index.html        ← carga ../_shared/core.{css,js} + ./skin.css
│   ├── skin.css          ← :root tokens + estilos por sección
│   └── assets/           ← fotos específicas de esta quinceañera
│
└── invitacion-xv-2/      ← plantilla 2: Camila Renata (clara)
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
cp -r web/invitacion-xv web/invitacion-xv-N
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
