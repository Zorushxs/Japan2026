// Genera las capturas de los mapas (privado/mapas/<id>.webp) con Chrome sin ventana (MapLibre + OpenFreeMap).
// Uso: node tools/mapas.js            → solo los mapas nuevos o cuyos puntos han cambiado
//      node tools/mapas.js --todos    → todos
// Los mapas salen de Datos.todosLosMapas() (los lugares con lat/lon de cada día y excursión). Se apunta en
// privado/mapas/indice.json qué puntos tenía cada captura, para no rehacer las que no han cambiado.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { PRIVADO, cargarDatos } = require('./comun');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIR = path.join(PRIVADO, 'mapas');
const INDICE = path.join(DIR, 'indice.json');
const TODOS = process.argv.includes('--todos');

fs.mkdirSync(DIR, { recursive: true });
const { Datos } = cargarDatos();
const mapas = Datos.todosLosMapas().map(m => ({
  id: m.id, color: m.color, puntos: m.puntos.map(({ n, nombre, lat, lon, casa }) => ({ n, nombre, lat, lon, casa: Boolean(casa) })),
}));
// Cambia VERSION para rehacerlos todos si cambia el dibujo.
const VERSION = 2;
const huella = m => crypto.createHash('sha1').update(JSON.stringify([VERSION, m.color, m.puntos])).digest('hex').slice(0, 12);
const indice = fs.existsSync(INDICE) ? JSON.parse(fs.readFileSync(INDICE, 'utf8')) : {};
const archivo = id => path.join(DIR, id + '.webp');

// Las capturas de mapas que ya no existen (y las de formatos viejos), fuera.
const ids = new Set(mapas.map(m => m.id));
fs.readdirSync(DIR).filter(f => /\.(jpg|webp)$/.test(f)).forEach(f => {
  const id = f.replace(/\.(jpg|webp)$/, '');
  if (f.endsWith('.webp') && ids.has(id)) return;
  fs.unlinkSync(path.join(DIR, f));
  if (!ids.has(id)) delete indice[id];
  console.log('borrado', f);
});

const pendientes = mapas.filter(m => TODOS || indice[m.id] !== huella(m) || !fs.existsSync(archivo(m.id)));
if (!pendientes.length) {
  fs.writeFileSync(INDICE, JSON.stringify(indice, null, 2));
  console.log(`Mapas al día (${mapas.length}).`);
  process.exit(0);
}
console.log(`Dibujando ${pendientes.length} de ${mapas.length} mapas…`);

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'mapas-'));
let chrome = null;

function terminar(codigo) {
  fs.writeFileSync(INDICE, JSON.stringify(indice, null, 2));
  if (chrome) chrome.kill();
  server.close();
  setTimeout(() => {
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
    process.exit(codigo);
  }, 500);
}

const leer = req => new Promise(resolve => {
  const trozos = [];
  req.on('data', t => trozos.push(t));
  req.on('end', () => resolve(Buffer.concat(trozos).toString()));
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/mapa.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'mapa.html')));
  } else if (req.url === '/trabajos') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pendientes));
  } else if (req.url.startsWith('/guardar/')) {
    const id = decodeURIComponent(req.url.slice('/guardar/'.length));
    const mapa = pendientes.find(m => m.id === id);
    const datos = await leer(req);
    if (mapa) {
      fs.writeFileSync(archivo(id), Buffer.from(datos.split(',')[1], 'base64'));
      indice[id] = huella(mapa);
      console.log('  ', id);
    }
    res.end('ok');
  } else if (req.url === '/fin') {
    const texto = await leer(req);
    res.end('ok');
    if (texto) console.error(texto);
    terminar(texto ? 1 : 0);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/mapa.html`;
  chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=800,600', `--user-data-dir=${perfil}`, url],
    { stdio: 'ignore' });
});
setTimeout(() => { console.error('Tiempo agotado.'); terminar(1); }, 10 * 60 * 1000);
