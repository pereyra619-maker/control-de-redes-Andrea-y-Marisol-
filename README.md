# CM Control PWA

App de control de redes sociales para community manager, pensada para usarse en PC y en celular como PWA (una sola base).

## Cómo usarla

1. Descomprimí este ZIP.
2. Abrí una terminal dentro de la carpeta.
3. Instalá dependencias:
   npm install
4. Ejecutá:
   npm run dev

## Para dejarla lista para producción

1. Ejecutá:
   npm run build
2. Subí la carpeta `dist` a Vercel, Netlify, o cualquier hosting estático.

## Cómo instalarla en PC
- Abrila en Chrome o Edge.
- Tocá el icono de instalar en la barra del navegador.

## Cómo instalarla en el celular
- Abrila en Chrome (Android) o Safari (iPhone).
- En Android: menú → “Agregar a pantalla principal”.
- En iPhone: compartir → “Añadir a pantalla de inicio”.

## Trabajo compartido
La app trae integración opcional con Supabase.
En la pestaña **Ajustes** tenés:
- URL del proyecto
- key pública
- nombre de usuario
- nombre/código del tablero
- crear, abrir, guardar y copiar link

### SQL para Supabase
Usá el bloque que la app muestra en Ajustes para crear la tabla `cm_shared_boards`.
