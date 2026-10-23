// Compila y cifra la app en index.html (lo único con datos del viaje que se publica).
// Uso: node tools/build.js
//   1. Junta app/index.html con su CSS, sus scripts y privado/viaje.js en un solo HTML.
//   2. Mete las capturas de privado/mapas/, los billetes de privado/billetes/ y las imágenes de privado/guias/ como
//      data: URI (ARCHIVOS). privado/originales/ (los PDF tal cual llegan) no se mete.
//   3. Lo cifra con AES-256-GCM; la clave sale de la contraseña con PBKDF2-SHA-256 (600.000 vueltas).
//   4. Lo pone dentro de tools/cerradura.html y lo escribe en index.html.
// Versión de INVITADO: si existe privado/contraseña-invitado.txt (o VIAJE_PASS_INVITADO), se cifra además una segunda
// copia de la app SIN billetes (ni sus archivos), sin enlaces de Drive y sin la base de datos compartida. La cerradura
// prueba la contraseña con las dos copias: según cuál abra, se ve la completa o la de invitado.
// La contraseña sale de la variable VIAJE_PASS o, si no está, de privado/contraseña.txt. La sal se guarda en
// privado/sal.txt y no cambia entre compilaciones, para que «Recordar en este dispositivo» siga valiendo al
// actualizar (cambiando la contraseña, sí deja de valer).
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { ROOT, APP, PRIVADO, cargarDatos } = require('./comun');
const { comprobar } = require('./comprobar');

const ITER = 600000;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.pdf': 'application/pdf' };

function contraseña() {
  if (process.env.VIAJE_PASS) return process.env.VIAJE_PASS;
  const archivo = path.join(PRIVADO, 'contraseña.txt');
  if (fs.existsSync(archivo)) return fs.readFileSync(archivo, 'utf8').trim();
  console.error('Falta la contraseña: ponla en privado/contraseña.txt (no se sube) o en la variable VIAJE_PASS.');
  process.exit(1);
}

function contraseñaInvitado() {
  if (process.env.VIAJE_PASS_INVITADO) return process.env.VIAJE_PASS_INVITADO;
  const archivo = path.join(PRIVADO, 'contraseña-invitado.txt');
  return fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8').trim() : null;
}

// Datos de la versión de invitado: los de privado/viaje.js ya evaluados, sin billetes, sin Drive y sin la base de
// datos, escritos de nuevo como JSON (así el texto quitado no llega ni cifrado). Cualquier otro enlace de Drive que
// apareciera en un texto también se borra.
function viajeInvitado() {
  const { VIAJE } = cargarDatos();
  const v = JSON.parse(JSON.stringify(VIAJE));
  v.invitado = true;
  v.billetes = [];
  delete v.drive;
  delete v.sincro;
  // Guías solo para la versión completa (`privada: true`), y lo que las nombre.
  const privadas = new Set((v.guias || []).filter(g => g.privada).map(g => g.id));
  v.guias = (v.guias || []).filter(g => !privadas.has(g.id));
  v.dias.forEach(d => { if (d.guias) d.guias = d.guias.filter(id => !privadas.has(id)); });
  Object.values(v.alojamientos || {}).forEach(a => { if (privadas.has(a.guia)) delete a.guia; });
  (v.avisos || []).forEach(a => { if (privadas.has(a.guia)) delete a.guia; });
  const limpio = JSON.parse(JSON.stringify(v), (k, valor) =>
    (typeof valor === 'string' && /drive\.google\.com/.test(valor) ? '' : valor));
  return `const VIAJE = ${JSON.stringify(limpio)};
`;
}

function sal() {
  const archivo = path.join(PRIVADO, 'sal.txt');
  if (!fs.existsSync(archivo)) {
    fs.writeFileSync(archivo, Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64'));
  }
  return fs.readFileSync(archivo, 'utf8').trim();
}

// { 'mapas/<id>.webp': 'data:image/webp;base64,…', 'billetes/…': …, 'guias/…': … }
// Los comunes (mapas, guías y avatares) van UNA vez, cifrados con una clave interna (CLAVE_COMUN) que solo está dentro
// de cada copia de la app; los billetes van solo dentro de la copia completa.
const COMUNES = ['mapas', 'guias', 'avatares'];
function archivos(carpetas) {
  const out = {};
  carpetas.forEach(carpeta => {
    const dir = path.join(PRIVADO, carpeta);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(nombre => {
      const mime = MIME[path.extname(nombre).toLowerCase()];
      if (!mime) return;
      out[`${carpeta}/${nombre}`] = `data:${mime};base64,` + fs.readFileSync(path.join(dir, nombre)).toString('base64');
    });
  });
  return out;
}

// Un script dentro de <script> no puede contener «</script».
const seguro = codigo => codigo.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

function juntar(invitado, claveComun) {
  let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
    `<style>\n${fs.readFileSync(path.join(APP, href), 'utf8')}</style>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    const codigo = invitado && /viaje\.js$/.test(src) ? viajeInvitado() : fs.readFileSync(path.join(APP, src), 'utf8');
    return `<script>\n${seguro(codigo)}</script>`;
  });
  // Rutas de app/index.html (../assets/…) a las de la página publicada, que está en la raíz (assets/…).
  html = html.replace(/(["'(])\.\.\/(assets\/|manifest\.webmanifest)/g, '$1$2');
  const lista = invitado ? {} : archivos(['billetes']);
  // La cerradura descifra los comunes con la clave de la marca KC y los deja en window.__COMUNES__.
  html = html.replace('<!--ARCHIVOS-->', () => `<!--KC:${claveComun}-->`
    + `<script>const ARCHIVOS = Object.assign({}, window.__COMUNES__ || {}, ${JSON.stringify(lista)});</script>`);
  return { html, lista };
}

async function cifrarConClave(texto, claveBruta) {
  const subtle = webcrypto.subtle;
  const clave = await subtle.importKey('raw', claveBruta, 'AES-GCM', false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const datos = await subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(texto));
  return { iv: Buffer.from(iv).toString('base64'), datos: Buffer.from(datos).toString('base64') };
}

async function cifrar(texto, pass, salB64) {
  const subtle = webcrypto.subtle;
  const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const clave = await subtle.deriveKey(
    { name: 'PBKDF2', salt: Buffer.from(salB64, 'base64'), iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const datos = await subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(texto));
  return { iv: Buffer.from(iv).toString('base64'), datos: Buffer.from(datos).toString('base64') };
}

(async () => {
  const errores = comprobar();
  if (errores.length) {
    errores.forEach(e => console.error('✗ ' + e));
    console.error('No se compila: corrige privado/viaje.js.');
    process.exit(1);
  }
  const claveComun = webcrypto.getRandomValues(new Uint8Array(32));
  const kc = Buffer.from(claveComun).toString('base64');
  const comunes = archivos(COMUNES);
  const { html, lista } = juntar(false, kc);
  Object.assign(lista, comunes);
  const s = sal();
  const cajas = [await cifrar(html, contraseña(), s)];
  const passInvitado = contraseñaInvitado();
  if (passInvitado) {
    const recortada = juntar(true, kc).html;
    if (/drive\.google\.com|firebasedatabase/.test(recortada)) {
      console.error('La versión de invitado aún tiene enlaces de Drive o de la base de datos: no se compila.');
      process.exit(1);
    }
    cajas.push(await cifrar(recortada, passInvitado, s));
  }
  const sobre = { v: 3, iter: ITER, sal: s, cajas, comun: await cifrarConClave(JSON.stringify(comunes), claveComun) };
  const plantilla = fs.readFileSync(path.join(__dirname, 'cerradura.html'), 'utf8');
  const salida = plantilla.replace('"__CIFRADO__"', () => JSON.stringify(sobre));
  fs.writeFileSync(path.join(ROOT, 'index.html'), salida);
  const mb = n => (n / 1048576).toFixed(2) + ' MB';
  const cuantos = carpeta => Object.keys(lista).filter(k => k.startsWith(carpeta + '/')).length;
  console.log(`index.html: ${mb(Buffer.byteLength(salida))} (${cuantos('mapas')} mapas, ${cuantos('billetes')} billetes, `
    + `${cuantos('guias')} imágenes de guías), cifrado${passInvitado ? ' + versión de invitado' : ''}.`);
})();
