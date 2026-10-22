// Prueba de lo compartido de los billetes (app/js/sincro.js) sin navegador: dos «móviles» (cada uno con su
// localStorage) contra una base de datos falsa que se comporta como Firebase Realtime Database (GET y PATCH .json).
// Uso: node tests/sincro.test.js
//      SINCRO_URL=https://….firebasedatabase.app node tests/sincro.test.js   → contra la base de datos de verdad, en una
//      sala de prueba que se borra al acabar.
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { webcrypto, randomBytes } = require('crypto');

const REAL = process.env.SINCRO_URL;
const SALA = REAL ? 'prueba-' + randomBytes(6).toString('hex') : 'sala-de-prueba';
const PAUSA = REAL ? 1500 : 300;

const ROOT = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fallos = 0;
const ok = (cond, texto) => {
  console.log((cond ? 'ok   ' : 'FALLO ') + texto);
  if (!cond) fallos++;
};
const espera = ms => new Promise(r => setTimeout(r, ms));

// ---------- Base de datos falsa ----------
const db = {};
const server = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', t => { cuerpo += t; });
  req.on('end', () => {
    const ruta = new URL(req.url, 'http://x').pathname.replace(/\.json$/, '');
    if (req.method === 'PATCH') Object.assign(db[ruta] = db[ruta] || {}, JSON.parse(cuerpo));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(req.method === 'GET' ? (db[ruta] || null) : {}));
  });
});

// ---------- Un «móvil» ----------
function movil(url, clave) {
  const almacen = {};
  const ctx = {
    console, fetch, btoa, atob, TextEncoder, TextDecoder, setTimeout, setInterval,
    crypto: webcrypto,
    localStorage: { getItem: k => almacen[k] ?? null, setItem: (k, v) => { almacen[k] = String(v); }, removeItem: k => delete almacen[k] },
    navigator: { onLine: true },
    document: { visibilityState: 'visible', addEventListener() {} },
    addEventListener() {},
  };
  ctx.window = ctx;
  ctx.window.CLAVE_VIAJE = clave;
  vm.createContext(ctx);
  const codigo = leer('privado/viaje.js')
    + `\nVIAJE.sincro = { url: ${JSON.stringify(url)}, sala: ${JSON.stringify(SALA)} };\n`
    + leer('app/js/datos.js') + '\n' + leer('app/js/sincro.js') + '\n({ Datos, Sincro })';
  return { ...vm.runInContext(codigo, ctx), almacen };
}

server.listen(0, '127.0.0.1', async () => {
  const url = REAL || `http://127.0.0.1:${server.address().port}`;
  console.log(REAL ? `Base de datos de verdad, sala ${SALA}` : 'Base de datos falsa');
  const clave = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const A = movil(url, clave), B = movil(url, clave);
  const billete = A.Datos.billete('shinkansen-27');
  const [primero, segundo] = A.Datos.archivosBillete(billete);
  const k1 = A.Sincro.clave(billete, primero), k2 = A.Sincro.clave(billete, segundo);

  // 1. A pone un nombre; B lo ve.
  A.Sincro.cambiar(k1, { nombre: 'Ramon' });
  await espera(PAUSA);
  await B.Sincro.traer();
  ok(B.Sincro.item(k1).nombre === 'Ramon', 'el nombre que pone un móvil lo ve el otro');

  // 2. En la base de datos no hay nada legible.
  const crudo = REAL ? await (await fetch(`${REAL}/viaje/${SALA}.json`)).text() : JSON.stringify(db);
  ok(crudo.length > 50 && !crudo.includes('Ramon') && !crudo.includes('shinkansen') && !crudo.includes('15-A'),
    'en la base de datos solo hay texto cifrado (ni el nombre ni el billete)');

  // 3. B marca otro como usado; A lo ve y conserva su nombre.
  B.Sincro.cambiar(k2, { usado: true });
  await espera(PAUSA);
  await A.Sincro.traer();
  ok(A.Sincro.item(k2).usado === true && A.Sincro.item(k1).nombre === 'Ramon', 'el «usado» del otro móvil llega');

  // 4. Los dos cambian el mismo: gana el último.
  A.Sincro.cambiar(k1, { nombre: 'Ana' });
  await espera(50);
  B.Sincro.cambiar(k1, { nombre: 'Marc' });
  await espera(PAUSA);
  await A.Sincro.traer();
  await B.Sincro.traer();
  ok(A.Sincro.item(k1).nombre === 'Marc' && B.Sincro.item(k1).nombre === 'Marc', 'si los dos cambian lo mismo, gana el último');

  // 5. Sin conexión: el cambio se queda pendiente y se envía al volver.
  const C = movil('http://127.0.0.1:1', clave);
  C.Sincro.cambiar(k2, { nombre: 'Laia' });
  await espera(PAUSA);
  ok(/Sin conexión/.test(C.Sincro.texto()) && C.Sincro.item(k2).nombre === 'Laia', 'sin conexión se guarda en el móvil');

  // 6. Con otra clave (otra contraseña) no se puede leer nada.
  const otra = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const D = movil(url, otra);
  await D.Sincro.traer();
  ok(D.Sincro.item(k1).nombre === '', 'con otra clave no se lee nada');

  if (REAL) await fetch(`${REAL}/viaje/${SALA}.json`, { method: 'DELETE' });
  server.close();
  console.log(fallos ? `${fallos} fallos` : 'TODO OK');
  process.exit(fallos ? 1 : 0);
});
