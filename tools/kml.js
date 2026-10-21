// Genera archivos KML (privado/kml/) para importar en Google My Maps: uno por capa (alojamientos, cada bloque y las
// excursiones). My Maps admite 10 capas por mapa y cada archivo importado es una capa.
// Uso: node tools/kml.js
const fs = require('fs');
const path = require('path');
const { PRIVADO, cargarDatos } = require('./comun');

const { VIAJE: V, Datos } = cargarDatos();
const DIR = path.join(PRIVADO, 'kml');
fs.mkdirSync(DIR, { recursive: true });
fs.readdirSync(DIR).filter(f => f.endsWith('.kml')).forEach(f => fs.unlinkSync(path.join(DIR, f)));

const xml = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const limpio = text => String(text).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
const corto = fecha => {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1]}`;
};
// KML usa colores aabbggrr.
const kmlColor = hex => 'ff' + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);

function placemark(nombre, descripcion, lugar, estilo) {
  return `    <Placemark>
      <name>${xml(nombre)}</name>
      <description>${xml(descripcion)}</description>
      <styleUrl>#${estilo}</styleUrl>
      <Point><coordinates>${lugar.lon},${lugar.lat},0</coordinates></Point>
    </Placemark>`;
}

function capa(archivo, nombre, color, placemarks) {
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(nombre)}</name>
    <Style id="p"><IconStyle><color>${kmlColor(color)}</color></IconStyle></Style>
${placemarks.join('\n')}
  </Document>
</kml>
`;
  fs.writeFileSync(path.join(DIR, archivo), kml);
  console.log(`${archivo}: ${placemarks.length} puntos`);
}

// Texto del paso del plan donde sale un lugar (para la descripción).
const pasoDe = (plan, id) => plan.find(p => (p.lugares || []).includes(id));
const descripcion = (paso, cabecera) => [cabecera, paso && paso.hora, paso && limpio(paso.texto)].filter(Boolean).join(' · ');

// 1. Alojamientos
capa('1-alojamientos.kml', 'Alojamientos', '#1f1c19', Datos.estancias()
  .filter(e => V.alojamientos[e.clave].lat != null)
  .map(e => {
    const a = V.alojamientos[e.clave];
    return placemark('🏠 ' + a.nombre, [`${corto(e.desde)} → ${corto(e.hasta)}`, a.direccion, a.notas && limpio(a.notas)]
      .filter(Boolean).join(' · '), a, 'p');
  }));

// 2. Un archivo por bloque: los lugares de cada día, numerados como en la app.
V.bloques.forEach((b, i) => {
  const dias = V.dias.filter(d => d.fecha >= b.desde && d.fecha <= b.hasta);
  const marcas = [];
  dias.forEach(d => {
    const numeros = Datos.numeros(Datos.mapasDia(d));
    Datos.lugaresDe(d).forEach(id => {
      const l = Datos.lugar(id);
      if (l.lat == null || l.casa) return;
      const n = numeros[id] ? numeros[id] + '. ' : '';
      marcas.push(placemark(`${corto(d.fecha)} · ${n}${l.nombre}`, descripcion(pasoDe(d.plan, id), d.titulo), l, 'p'));
    });
  });
  const color = Datos.zona(dias[0].zona).color;
  capa(`${i + 2}-${b.titulo.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.kml`, b.titulo, color, marcas);
});

// 3. Excursiones, por ciudad de salida.
['Osaka', 'Tokio'].forEach((desde, i) => {
  const marcas = [];
  V.excursiones.filter(e => e.desde === desde).forEach(e => {
    const numeros = Datos.numeros(Datos.mapasExcursion(e));
    Datos.lugaresDe(e).forEach(id => {
      const l = Datos.lugar(id);
      if (l.lat == null) return;
      const n = numeros[id] ? numeros[id] + '. ' : '';
      marcas.push(placemark(`${e.emoji} ${e.titulo} · ${n}${l.nombre}`, descripcion(pasoDe(e.plan, id), e.titulo), l, 'p'));
    });
  });
  capa(`${V.bloques.length + 2 + i}-excursiones-desde-${desde.toLowerCase()}.kml`, `Excursiones desde ${desde}`,
    Datos.zona(desde === 'Osaka' ? 'osaka' : 'tokio').color, marcas);
});
