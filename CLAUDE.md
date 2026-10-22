# Viaje: notas para Claude

App web para consultar el plan de un viaje (calendario, día a día, excursiones, mapas y billetes), publicada en GitHub
Pages **cifrada con contraseña**. Este archivo y el README son públicos: **nada de datos del viaje aquí** (fechas
concretas, sitios, alojamientos, nombres).

## Seguridad (lo más importante)

- Los datos del viaje están en `privado/` (`viaje.js`, `mapas/`, `billetes/`, `contraseña.txt`, `sal.txt`), que está en
  `.gitignore` y **nunca se sube**. Lo único publicado con datos es `index.html`, cifrado por `tools/build.js`.
- No pongas datos del viaje en `app/`, `tools/`, `tests/`, el README ni los mensajes de commit.
- `index.html` solo se genera con la contraseña de verdad (`privado/contraseña.txt` o `VIAJE_PASS`). Si compilas con una
  de prueba, bórralo después para que no se publique por error.
- Cifrado: AES-256-GCM; la clave sale de la contraseña con PBKDF2-SHA-256 (600.000 vueltas) y la sal fija de
  `privado/sal.txt` (así «Recordar en este dispositivo» sigue valiendo tras cada actualización). La cerradura
  ([tools/cerradura.html](tools/cerradura.html)) descifra con WebCrypto y escribe la app en la misma ventana: su código va
  dentro de una función para no chocar con los `const` globales de la app.
- **La app solo se escribe una vez por ventana y con la página ya cargada** (`mostrar` espera a `load`; si ya se
  escribió, recarga). Si no: con «Recordar» se abría antes de acabar de cargar, `document.open()` no vaciaba la página y
  la app salía debajo de la cerradura; y al escribirla dos veces sus `const` chocaban y quedaba vacía. La prueba
  `tests/cerradura.js` tiene el caso «recordar» para esto.

- **Contraseña de invitado** (`privado/contraseña-invitado.txt` o `VIAJE_PASS_INVITADO`): `index.html` lleva dos copias
  cifradas de la app (`cajas`), una por contraseña; la cerradura prueba con las dos. La de invitado se genera desde los
  datos ya evaluados y limpios (`viajeInvitado()`: sin billetes, sin `drive`, sin `sincro`, sin ningún texto con
  drive.google.com) y sin archivos de billetes; build.js se niega a compilar si aún encuentra Drive o la base de datos.
  Mapas, guías y avatares van una sola vez (`comun`), cifrados con una clave interna que viaja dentro de cada copia
  (marca `<!--KC:…-->`); la cerradura los deja en `window.__COMUNES__`. La prueba tiene el caso «invitado».

- **sw.js** (no va dentro de index.html: se sube tal cual): guarda la página al instalarse y en cada visita pregunta
  con `If-None-Match`/`If-Modified-Since` usando la copia guardada; si no ha cambiado, 304 y la copia. Así cada móvil
  solo descarga los ~12 MB cuando se publica una versión nueva. Sin red (o 4 s sin respuesta), la copia.

## Tecnología y convenciones

- HTML, CSS y JS sin dependencias, mobile-first, tema claro/oscuro y 5 paletas (`data-paleta` en `<html>`: mugiwara
  —por defecto—, aizome, sakura, matcha, neon; `viaje:paleta`; CSS al final de styles.css y en la cerradura).
  Logo: `assets/logo.png`, `favicon.png`, `icon-*.png` (app/index.html los pide con `../assets/`; build.js lo arregla). Textos de la interfaz en castellano; comentarios del
  código en castellano.
- Scripts clásicos con un IIFE que expone un objeto global: `U` (util), `Datos`, `Piezas`, `Calendario`, `Dia`,
  `Excursiones`, `Billetes`, `Info`, `Mapa`, `Guia`, `Alojamientos`, `App`. El orden de carga es el de [app/index.html](app/index.html).
- `U.html` escapa solo; `U.rich` admite `**negrita**` y `*cursiva*` en los textos de los datos. Clics con
  `U.onActions(root, { nombre(el, e) {…} })` y `data-act`.
- Pantallas `{ nav, render(root, arg), key(e) }`. Rutas: `#/`, `#/dia/AAAA-MM-DD`, `#/hoy`, `#/excursiones`,
  `#/excursion/<id>`, `#/billetes[/<id>]`, `#/info`, `#/mapa` (My Maps incrustado; `VIAJE.mapaGoogle`), `#/alojamientos`, `#/guia/<id>`.
- `Datos` ([app/js/datos.js](app/js/datos.js)) no toca el DOM: Node también lo carga (tools/comun.js) para los mapas
  y las comprobaciones.
- Los commits los hace el usuario. Estilo: en inglés, `Add: …` / `Fix: …`.

## Datos (privado/viaje.js)

`VIAJE = { titulo, inicio, fin, zonas, bloques, alojamientos, billetes, info, lugares, dias, excursiones }`.

- **Día**: `fecha`, `zona`, `titulo`, `alojamiento?`, `equipaje?`, `porDefinir?`, `plan[]`, `excursiones?[]`, `mapas?`.
- **Paso del plan**: `hora?`, `texto`, `tipo?` (`info | tiempo | aviso | importante | opcional | alternativa`, los
  colores del documento original), `lugares?[]`, `sub?[]`, `billete?`, `corto?`.
- **Resumen | Detalle** (botón junto a «Plan»; siempre abre en detalle, el resumen no se guarda): en resumen solo salen los pasos con
  `corto` (una línea, sin subpuntos); en detalle, el texto entero y, debajo, el `info` de cada lugar (qué es).
- **Paso solo de algunos**: `para: [nombres]` lo pinta plegable: abierto para ellos (o si no has dicho quién eres),
  plegado con sus avatares para los demás. `excepto: [nombres]` al revés: plegado («Sin X ni Y») solo para esos y
  normal para el resto. La prueba de la cerradura recorre todos los días con una persona elegida.
- **Paso**: además, `enlaces?: [{ texto, url }]` (chips de enlace web). Los textos admiten `[texto](https://…)`.
- **Lugar**: `nombre`, `info?` (qué es, sale en detalle), `url?` (enlace propio de Google Maps), `q` (búsqueda de Google Maps), `lat`/`lon` opcionales (sin
  ellas no sale en la captura).
- **Alojamiento** (`alojamientos.<CLAVE>`): `nombre`, `direccion`, `q?` (búsqueda de Google Maps, p. ej. coordenadas
  exactas; si no hay, la dirección), `notas?`, `lat`/`lon`.
  En el plan se nombra como lugar `'aloj:<CLAVE>'` (sale con una casa, sin número). El día con `alojamiento` es el del
  check-in; `Datos.duerme`/`despierta` dicen dónde se duerme cada noche, y cada día enseña su alojamiento.
- **Días de coche**: botón con la ruta entera (del alojamiento donde te levantas, por las paradas del plan, hasta donde
  duermes); `rutaCoche: { desde?, hasta? }` lo cambia. En transporte público Google no admite paradas intermedias, así
  que las rutas de los mapas de ciudad van sin modo.
- **Mapas**: sin `mapas`, uno con los lugares del plan que tienen coordenadas; `mapas: []` no pone ninguno; con una lista
  `[{ titulo, lugares }]` se dividen (útil si los puntos quedan amontonados). Los números siguen de un mapa al siguiente y
  coinciden con los del plan.
- **Billete**: `id`, `titulo`, `fecha`, `hora?`, `nota?`, `archivo` o `archivos` (rutas dentro de `privado/`, p. ej.
  `billetes/x.pdf`; también `{ ruta, nombre }`, uno por persona). Sin archivo, sale como pendiente. Para QR mejor una
  imagen (PNG/JPG) que un PDF: se ve dentro de la app, sobre blanco. **De un PDF se saca cada página ENTERA, sin
  recortar nada** (el usuario lo pidió así): página a escala 2 con pypdfium2, PNG; el PDF original en `privado/originales/`.
  Para repartir entre parte del grupo: `para: [nombres]`; y otros textos: `cosa: 'pase'`, `marca: ['Sin canjear',
  'Canjeado', 'canjeados']` (por defecto «asiento» y «Usado»). `reparto: false` para no repartir (p. ej. los coches).
  `para` también decide qué ve cada uno: en Billetes y en cada día la lista sigue el orden de fechas, y los billetes
  que son solo de otros salen en su sitio pero atenuados y compactos («De otros:»; `Datos.esPara`, `Piezas.billetesDe`).
  Cada billete puede llevar `drive` (su carpeta de Google Drive).
  Vuelos: `tramos: [{ vuelo, tambien?, aerolinea, avion?, clase?, de/a: { iata, ciudad, fecha, hora?, terminal? },
  aviso?, asientos?: { nombre: '34G' }, escala? }]`, `reserva: { localizador, trip? }`, `pasajeros: { nombre: nºbillete }`.

## Billetes compartidos (nombres y «usado»)

- [app/js/sincro.js](app/js/sincro.js): de quién es cada entrada y si se ha usado, igual en todos los móviles. Se guarda
  en localStorage (`viaje:estado`, funciona sin conexión) y se sincroniza con Firebase Realtime Database por REST
  (`GET`/`PATCH` de `<url>/viaje/<sala>/items.json`), configurado en `VIAJE.sincro = { url, sala }`. Sin `url`, cada
  móvil guarda lo suyo.
- Cada entrada va **cifrada con la clave de la app** (AES-GCM, IV aleatorio) y su nombre en la base de datos es un hash
  de `sala|billete|archivo`: allí no hay nada legible. La cerradura deja la clave en `window.CLAVE_VIAJE` (por eso la
  deriva con `encrypt` y `decrypt`). Gana el cambio más reciente de cada entrada.
- «Soy: …» (`viaje:soy`) es solo de cada móvil: pone tu billete el primero y marcado.
- `VIAJE.grupo` (los nombres de los botones) y `VIAJE.avatares` (`{ nombre: 'avatares/x.webp' }`, fotos redondas en
  `privado/avatares/`, 256 px) y `VIAJE.marcos` (`{ nombre: 'dorado' | 'oscuro' | 'nika' }`; nika = Gear 5: nubes, sol de Nika y rebote de goma;: anillo de oro con bisel, destello que lo recorre, corona SVG y chispas; o de humo con pluma y sello 鴉); sin foto,
  inicial en un círculo con un color fijo por posición en el grupo
  (`Piezas.avatar`).
- **Subidas** ([app/js/subidas.js](app/js/subidas.js)): huecos para subir desde el móvil el comprobante de una reserva
  (foto reducida a 1600 px JPEG o PDF de hasta 3 MB). Se ponen con `subidas: { id, titulo }` en una guía, un día o un
  billete (el mismo `id` en varios sitios comparte los archivos). Van cifrados con la clave de la app en
  `viaje/<sala>/subidas/<hash>/<id>` (`Sincro.subir/listarSubidas/borrarSubida`); la última lista vista se guarda en el
  móvil. No salen en la versión de invitado.
- Reglas de Firebase: lectura y escritura solo en `viaje/$sala` (la raíz cerrada) y validación de `{ c, t }`.
- Prueba: `node tests/sincro.test.js` (dos «móviles» contra una base de datos falsa).

## Flujo

1. Editar `privado/viaje.js` (y dejar billetes en `privado/billetes/`).
2. `node tools/kml.js` — capas para importar en Google My Maps (`privado/kml/`); el enlace del mapa va en
   `VIAJE.mapaGoogle`.
3. `node tools/mapas.js` — rehace solo las capturas que han cambiado (`--todos` para todas; `VERSION` en el script si
   cambia el dibujo). MapLibre + mapas vectoriales de OpenFreeMap (sin clave) en Chrome sin ventana (WebGL con
   SwiftShader), al doble de resolución, nombres en castellano/inglés/latín, WebP. CARTO pide clave y las capturas de
   Google necesitan la Static Maps API (de pago).
4. `node tools/build.js` — comprueba los datos (`tools/comprobar.js`), junta y cifra en `index.html`.
5. Auditoría de privacidad: `node tests/auditoria.js` (index.html sin descifrar, versión de invitado, Firebase y repo).
   Es pública: todo lo que busca lo saca de privado/, no escribas datos en ella.
6. Probar: `node tests/cerradura.js` (contraseña buena y mala en Chrome sin ventana). Capturas a 390 px de la app sin
   cifrar: `python -m http.server 8790` y `bash tests/captura.sh salida.png "/dia/AAAA-MM-DD" light|dark`.
