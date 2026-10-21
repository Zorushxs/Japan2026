// Prueba la página cifrada (index.html) en Chrome sin ventana: la contraseña buena abre la app (bien, una sola vez),
// una mala no, y con «Recordar» al recargar se abre sola.
// Uso: VIAJE_PASS=<contraseña> node tests/cerradura.js   (si no, lee privado/contraseña.txt)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASS = process.env.VIAJE_PASS || fs.readFileSync(path.join(ROOT, 'privado', 'contraseña.txt'), 'utf8').trim();
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let esperando = null;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/resultado') {
    let body = '';
    req.on('data', t => { body += t; });
    req.on('end', () => { res.end('ok'); if (esperando) esperando(body); });
    return;
  }
  const ruta = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!ruta.startsWith(ROOT) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
  res.end(fs.readFileSync(ruta));
});

function probar(query) {
  return new Promise(resolve => {
    const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cerradura-'));
    const url = `http://127.0.0.1:${server.address().port}/tests/cerradura.html?${query}`;
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${perfil}`, url],
      { stdio: 'ignore' });
    const fin = texto => {
      esperando = null;
      chrome.kill();
      setTimeout(() => { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} resolve(texto); }, 500);
    };
    esperando = fin;
    setTimeout(() => fin('FALLO sin respuesta'), 60000);
  });
}

server.listen(0, '127.0.0.1', async () => {
  const pass = 'pass=' + encodeURIComponent(PASS);
  const resultados = [];
  for (const modo of ['buena', 'mala', 'recordar']) resultados.push(await probar(`modo=${modo}&${pass}`));
  resultados.forEach(r => console.log(r));
  server.close();
  process.exit(resultados.every(r => r.startsWith('OK')) ? 0 : 1);
});
