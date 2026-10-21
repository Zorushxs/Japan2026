// Compila y cifra la app en index.html (lo único con datos del viaje que se publica).
// Uso: node tools/build.js
//   1. Junta app/index.html con su CSS, sus scripts y privado/viaje.js en un solo HTML.
//   2. Mete las capturas de privado/mapas/, los billetes de privado/billetes/ y las imágenes de privado/guias/ como
//      data: URI (ARCHIVOS). privado/originales/ (los PDF tal cual llegan) no se mete.
//   3. Lo cifra con AES-256-GCM; la clave sale de la contraseña con PBKDF2-SHA-256 (600.000 vueltas).
//   4. Lo pone dentro de tools/cerradura.html y lo escribe en index.html.
// La contraseña sale de la variable VIAJE_PASS o, si no está, de privado/contraseña.txt. La sal se guarda en
// privado/sal.txt y no cambia entre compilaciones, para que «Recordar en este dispositivo» siga valiendo al
// actualizar (cambiando la contraseña, sí deja de valer).
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { ROOT, APP, PRIVADO } = require('./comun');
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

function sal() {
  const archivo = path.join(PRIVADO, 'sal.txt');
  if (!fs.existsSync(archivo)) {
    fs.writeFileSync(archivo, Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64'));
  }
  return fs.readFileSync(archivo, 'utf8').trim();
}

// { 'mapas/<id>.webp': 'data:image/webp;base64,…', 'billetes/…': …, 'guias/…': … }
function archivos() {
  const out = {};
  ['mapas', 'billetes', 'guias'].forEach(carpeta => {
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

function juntar() {
  let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
    `<style>\n${fs.readFileSync(path.join(APP, href), 'utf8')}</style>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
    `<script>\n${seguro(fs.readFileSync(path.join(APP, src), 'utf8'))}</script>`);
  const lista = archivos();
  html = html.replace('<!--ARCHIVOS-->', () => `<script>const ARCHIVOS = ${JSON.stringify(lista)};</script>`);
  return { html, lista };
}

async function cifrar(texto, pass, salB64) {
  const subtle = webcrypto.subtle;
  const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const clave = await subtle.deriveKey(
    { name: 'PBKDF2', salt: Buffer.from(salB64, 'base64'), iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const datos = await subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(texto));
  return { v: 1, iter: ITER, sal: salB64, iv: Buffer.from(iv).toString('base64'), datos: Buffer.from(datos).toString('base64') };
}

(async () => {
  const errores = comprobar();
  if (errores.length) {
    errores.forEach(e => console.error('✗ ' + e));
    console.error('No se compila: corrige privado/viaje.js.');
    process.exit(1);
  }
  const { html, lista } = juntar();
  const sobre = await cifrar(html, contraseña(), sal());
  const plantilla = fs.readFileSync(path.join(__dirname, 'cerradura.html'), 'utf8');
  const salida = plantilla.replace('"__CIFRADO__"', () => JSON.stringify(sobre));
  fs.writeFileSync(path.join(ROOT, 'index.html'), salida);
  const mb = n => (n / 1048576).toFixed(2) + ' MB';
  const cuantos = carpeta => Object.keys(lista).filter(k => k.startsWith(carpeta + '/')).length;
  console.log(`index.html: ${mb(Buffer.byteLength(salida))} (${cuantos('mapas')} mapas, ${cuantos('billetes')} billetes, `
    + `${cuantos('guias')} imágenes de guías), cifrado.`);
})();
