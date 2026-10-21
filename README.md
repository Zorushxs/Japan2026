# Viaje

App web para consultar el plan de un viaje desde el móvil: calendario, día a día con mapas y enlaces a Google Maps,
excursiones y billetes. Funciona sin conexión (se puede instalar como app).

**Está cifrada**: `index.html` solo se abre con la contraseña. Los datos en claro nunca se suben al repositorio.

## Publicar una versión nueva

```
node tools/mapas.js     # capturas de los mapas que han cambiado
node tools/build.js     # comprueba los datos y genera index.html cifrado
```

Después, commit y push de `index.html`. GitHub Pages sirve la raíz de la rama principal.

La contraseña se lee de `privado/contraseña.txt` (no se sube) o de la variable `VIAJE_PASS`.

## Estructura

```
index.html            Página publicada: la app entera, cifrada (la genera tools/build.js)
sw.js                 Service worker (sin conexión)
manifest.webmanifest  Para instalarla como app
assets/               Iconos
app/                  Código de la app (sin datos)
tools/build.js        Junta y cifra
tools/cerradura.html  Pantalla de la contraseña
tools/mapas.js        Capturas de los mapas (Chrome sin ventana, MapLibre + OpenFreeMap)
tools/kml.js          Capas para importar en Google My Maps
tools/comprobar.js    Comprueba los datos
tests/                Prueba de la cerradura y capturas
privado/              Datos, mapas, billetes y contraseña (en .gitignore)
```

Mapas © [OpenFreeMap](https://openfreemap.org) © [OpenStreetMap](https://www.openstreetmap.org/copyright).
