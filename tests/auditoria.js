// Auditoría de privacidad. Uso: node tests/auditoria.js
// 1. index.html sin descifrar: no tiene que haber nada legible.
// 2. Descifrado con la contraseña de invitado: no tiene que haber billetes, Drive, reservas ni la base de datos.
// 3. Descifrado con la contraseña completa: tiene que estar todo (para saber que la prueba mira bien).
// 4. Firebase: lo guardado (asientos y subidas) tiene que estar cifrado; la raíz cerrada.
// 5. Repo: ningún archivo con datos del viaje fuera de privado/ ni privado/ en git.
// Este archivo es PÚBLICO: todo lo que busca lo saca de los datos privados; no puede llevar escrito ningún dato.
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { execSync } = require('child_process');
const { cargarDatos } = require('../tools/comun');

const ROOT = path.join(__dirname, '..');
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { VIAJE: V } = cargarDatos();
const PASS = leer('privado/contraseña.txt').trim();
const PASS_INV = leer('privado/contraseña-invitado.txt').trim();
let fallos = 0;
const ok = (cond, texto) => { console.log((cond ? 'ok    ' : 'FALLO ') + texto); if (!cond) fallos++; };
const fugas = (texto, lista) => lista.filter(s => s && texto.includes(s));

// Lo que nunca debe verse sin la contraseña completa.
const SECRETOS = [V.sincro.url, V.sincro.sala, V.drive, PASS, PASS_INV];
const LOCALIZADORES = [];
V.billetes.forEach(b => {
  if (b.reserva) { SECRETOS.push(b.reserva.localizador, b.reserva.trip); LOCALIZADORES.push(b.reserva.localizador); }
  Object.values(b.pasajeros || {}).forEach(n => SECRETOS.push(n));
  // Números de pase, de reserva y nombres completos de titulares que salen en las notas.
  const nota = b.nota || '';
  [...nota.matchAll(/\b(?:MNN\d+|W0\d{10,}|\d{9})\b/g)].forEach(m => SECRETOS.push(m[0]));
  [...nota.matchAll(/\(([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+){1,3})\)/g)].forEach(m => SECRETOS.push(m[1]));
  if (b.drive) SECRETOS.push(b.drive);
});
const secretos = [...new Set(SECRETOS.filter(Boolean))];
// Direcciones de los alojamientos y nombres del grupo.
const DIRECCIONES = Object.values(V.alojamientos).map(a => (a.direccion || '').split(',')[0]).filter(t => t.length > 6);
const GRUPO = V.grupo || [];

async function descifrar(sobre, pass) {
  const base = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const clave = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(sobre.sal, 'base64'),
    iterations: sobre.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  for (const c of sobre.cajas) {
    try {
      const p = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(c.iv, 'base64') }, clave,
        Buffer.from(c.datos, 'base64'));
      return new TextDecoder().decode(p);
    } catch {}
  }
  return null;
}

(async () => {
  const pagina = leer('index.html');
  console.log(`\n1. index.html publicado (${(pagina.length / 1048576).toFixed(1)} MB, sin contraseña)`);
  const f1 = fugas(pagina, secretos);
  ok(!f1.length, `ningún dato secreto legible (${secretos.length} comprobados)` + (f1.length ? ': ' + f1 : ''));
  // Fuera del bloque cifrado (dentro, una palabra corta puede salir por casualidad entre millones de letras al azar).
  const publico = pagina.replace(/<script id="cifrado"[\s\S]*?<\/script>/, '');
  const visibles = fugas(publico, [...DIRECCIONES, ...GRUPO, V.dias[0].titulo, Object.values(V.lugares)[0].nombre]);
  ok(!visibles.length, 'la parte sin cifrar no tiene sitios, alojamientos ni nombres' + (visibles.length ? ': ' + visibles : ''));
  const sobre = JSON.parse(/<script id="cifrado" type="application\/json">([\s\S]*?)<\/script>/.exec(pagina)[1]);
  ok(sobre.cajas.length === 2 && sobre.iter >= 600000, `${sobre.cajas.length} copias cifradas, PBKDF2 con ${sobre.iter} vueltas`);
  ok(await descifrar(sobre, 'contraseña-falsa-123') === null, 'una contraseña inventada no abre nada');

  console.log('\n2. Versión de INVITADO');
  const inv = await descifrar(sobre, PASS_INV);
  ok(inv && inv.includes('"invitado":true'), 'la contraseña de invitado abre la versión de invitado');
  const f2 = fugas(inv, secretos.filter(s => s !== PASS));
  ok(!f2.length, 'sin localizadores, nº de billete, pases, nombres completos, Firebase ni Drive' + (f2.length ? ': ' + f2 : ''));
  const archivosInv = JSON.parse(/Object\.assign\(\{\}, window\.__COMUNES__ \|\| \{\}, (\{[\s\S]*?\})\);/.exec(inv)[1]);
  ok(!Object.keys(archivosInv).length, 'sin ninguna imagen de billete, pase, vuelo ni comprobante');
  ok(/"billetes":\[\]/.test(inv), 'la lista de billetes está vacía');
  ok(!/"sincro"|firebasedatabase/.test(inv), 'no conoce la base de datos (no puede leer asientos ni subidas)');
  ok(!/drive\.google\.com/.test(inv), 'ningún enlace de Drive');

  console.log('\n3. Versión COMPLETA (control)');
  const full = await descifrar(sobre, PASS);
  ok(full && fugas(full, [...LOCALIZADORES, V.sincro.url]).length === LOCALIZADORES.length + 1,
    'la contraseña completa sí tiene billetes, reservas y la base de datos');

  console.log('\n4. Firebase (lo que hay guardado de verdad)');
  const raiz = await (await fetch(V.sincro.url + '/.json')).json();
  ok(raiz && raiz.error, 'la raíz está cerrada: no se puede listar nada sin el código de la sala');
  const sala = await (await fetch(`${V.sincro.url}/viaje/${V.sincro.sala}.json`)).text();
  const f4 = fugas(sala, [...GRUPO, 'billetes/', 'Asiento', 'data:image', 'data:application', ...V.billetes.map(b => b.id)]);
  ok(!f4.length, `lo guardado (${(sala.length / 1024).toFixed(1)} KB) solo es texto cifrado` + (f4.length ? ': ' + f4 : ''));
  const datos = JSON.parse(sala || 'null') || {};
  const nSub = Object.values(datos.subidas || {}).reduce((n, h) => n + Object.keys(h).length, 0);
  console.log(`        ${nSub} archivos subidos ahora mismo; ${Object.keys(datos.items || {}).length} asientos guardados`);

  console.log('\n5. Repositorio');
  const enGit = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(Boolean);
  const pendientes = execSync('git status --porcelain --untracked-files=all', { cwd: ROOT }).toString().split('\n')
    .filter(Boolean).map(l => l.slice(3));
  const todos = [...new Set([...enGit, ...pendientes])].filter(f => fs.existsSync(path.join(ROOT, f)));
  ok(!todos.some(f => f.startsWith('privado/')), `nada de privado/ en git ni pendiente de subir (${todos.length} archivos)`);
  ok(!todos.some(f => /\.pdf$|contrase|sal\.txt$|viaje\.js$/.test(f)), 'ningún PDF, contraseña, sal ni viaje.js');
  const conDatos = todos.filter(f => f !== 'index.html' && !/\.(png|webp|jpg)$/.test(f))
    .filter(f => fugas(fs.readFileSync(path.join(ROOT, f), 'utf8'), [...secretos, ...DIRECCIONES]).length);
  ok(!conDatos.length, 'ningún archivo del repo (código, notas, pruebas) tiene datos del viaje' + (conDatos.length ? ': ' + conDatos : ''));

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
  process.exit(fallos ? 1 : 0);
})();
