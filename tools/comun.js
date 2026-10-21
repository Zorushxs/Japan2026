// Lo que comparten las herramientas de Node: rutas y cargar los datos del viaje (privado/viaje.js + app/js/datos.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const PRIVADO = path.join(ROOT, 'privado');

// Ejecuta viaje.js y datos.js como en el navegador y devuelve { VIAJE, Datos }.
function cargarDatos() {
  const codigo = fs.readFileSync(path.join(PRIVADO, 'viaje.js'), 'utf8') + '\n'
    + fs.readFileSync(path.join(APP, 'js', 'datos.js'), 'utf8') + '\n({ VIAJE, Datos })';
  return vm.runInNewContext(codigo, {}, { filename: 'viaje+datos.js' });
}

module.exports = { ROOT, APP, PRIVADO, cargarDatos };
