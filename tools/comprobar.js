// Comprueba privado/viaje.js: que cada lugar, billete y excursión nombrados existan, que los días vayan seguidos del
// inicio al fin y que cada zona exista. tools/build.js lo pasa antes de compilar. Uso: node tools/comprobar.js
const fs = require('fs');
const path = require('path');
const { PRIVADO, cargarDatos } = require('./comun');

function comprobar() {
  const { VIAJE: V, Datos } = cargarDatos();
  const errores = [];
  const pasos = (donde, plan) => plan.forEach((p, i) => {
    (p.lugares || []).forEach(id => { if (!Datos.existeLugar(id)) errores.push(`${donde}, paso ${i + 1}: no existe el lugar «${id}»`); });
    [].concat(p.billete || []).forEach(id => {
      if (!Datos.billete(id)) errores.push(`${donde}, paso ${i + 1}: no existe el billete «${id}»`);
    });
    if (!p.texto) errores.push(`${donde}, paso ${i + 1}: sin texto`);
    (p.imagenes || []).forEach(c => {
      if (!fs.existsSync(path.join(PRIVADO, c.ruta))) errores.push(`${donde}, paso ${i + 1}: no está la imagen privado/${c.ruta}`);
    });
  });
  const mapas = (donde, entidad) => (entidad.mapas || []).forEach(m => m.lugares.forEach(id => {
    if (!Datos.existeLugar(id)) errores.push(`${donde}, mapa «${m.titulo}»: no existe el lugar «${id}»`);
  }));

  let esperado = V.inicio;
  V.dias.forEach(d => {
    if (d.fecha !== esperado) errores.push(`Día ${d.fecha}: tocaba ${esperado}`);
    esperado = addDay(d.fecha);
    if (!V.zonas[d.zona]) errores.push(`Día ${d.fecha}: no existe la zona «${d.zona}»`);
    if (d.alojamiento && !V.alojamientos[d.alojamiento]) errores.push(`Día ${d.fecha}: no existe el alojamiento «${d.alojamiento}»`);
    (d.guias || []).forEach(id => { if (!Datos.guia(id)) errores.push(`Día ${d.fecha}: no existe la guía «${id}»`); });
    (d.excursiones || []).forEach(id => { if (!Datos.excursion(id)) errores.push(`Día ${d.fecha}: no existe la excursión «${id}»`); });
    pasos(`Día ${d.fecha}`, d.plan);
    if (d.rutaCoche) [d.rutaCoche.desde, d.rutaCoche.hasta].filter(Boolean).forEach(id => {
      if (!Datos.existeLugar(id)) errores.push(`Día ${d.fecha}: rutaCoche, no existe el lugar «${id}»`);
    });
    mapas(`Día ${d.fecha}`, d);
  });
  if (V.dias.length && V.dias[V.dias.length - 1].fecha !== V.fin) errores.push(`El último día no es ${V.fin}`);

  (V.avisos || []).forEach(a => {
    if (!a.id || !/^\d{4}-\d\d-\d\d$/.test(a.desde) || !/^\d{4}-\d\d-\d\d$/.test(a.hasta)) {
      errores.push(`Aviso «${a.id}»: falta id o las fechas desde/hasta (AAAA-MM-DD)`);
    }
    if (a.guia && !Datos.guia(a.guia)) errores.push(`Aviso «${a.id}»: no existe la guía «${a.guia}»`);
  });
  (V.quienVa || []).forEach(f => {
    if (!Datos.excursion(f.id) && !f.titulo) errores.push(`quienVa: «${f.id}» no es una excursión y no tiene titulo`);
    [...(f.si || []), ...(f.quizas || [])].forEach(n => {
      if (!(V.grupo || []).includes(n)) errores.push(`quienVa ${f.id}: «${n}» no está en el grupo`);
    });
  });
  Object.entries(V.alojamientos || {}).forEach(([clave, a]) => {
    if (a.guia && !Datos.guia(a.guia)) errores.push(`Alojamiento ${clave}: no existe la guía «${a.guia}»`);
  });
  (V.guias || []).forEach(g => g.bloques.forEach(b => {
    (b.lugares || []).forEach(id => {
      if (!Datos.existeLugar(id)) errores.push(`Guía ${g.id}: no existe el lugar «${id}»`);
    });
    if (b.imagen && !fs.existsSync(path.join(PRIVADO, b.imagen))) {
      errores.push(`Guía ${g.id}: no está la imagen privado/${b.imagen}`);
    }
    (b.capturas || []).forEach(c => {
      if (!fs.existsSync(path.join(PRIVADO, c.ruta))) errores.push(`Guía ${g.id}: no está la imagen privado/${c.ruta}`);
    });
  }));

  V.excursiones.forEach(e => {
    if (!V.zonas[e.zona]) errores.push(`Excursión ${e.id}: no existe la zona «${e.zona}»`);
    pasos(`Excursión ${e.id}`, e.plan);
    mapas(`Excursión ${e.id}`, e);
  });

  Object.entries(V.avatares || {}).forEach(([nombre, ruta]) => {
    if (!fs.existsSync(path.join(PRIVADO, ruta))) errores.push(`Avatar de ${nombre}: no está privado/${ruta}`);
  });

  const ids = new Set();
  V.billetes.forEach(b => {
    if (ids.has(b.id)) errores.push(`Billete repetido: ${b.id}`);
    ids.add(b.id);
    if (b.guia && !Datos.guia(b.guia)) errores.push(`Billete ${b.id}: no existe la guía «${b.guia}»`);
    Datos.archivosBillete(b).forEach(a => {
      if (!fs.existsSync(path.join(PRIVADO, a.ruta))) errores.push(`Billete ${b.id}: no está el archivo privado/${a.ruta}`);
    });
  });
  return errores;
}

function addDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return date.toISOString().slice(0, 10);
}

module.exports = { comprobar };

if (require.main === module) {
  const errores = comprobar();
  errores.forEach(e => console.error('✗ ' + e));
  console.log(errores.length ? `${errores.length} errores.` : 'Datos correctos.');
  process.exit(errores.length ? 1 : 0);
}
