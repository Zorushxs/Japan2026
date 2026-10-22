// Acceso a los datos del viaje (VIAJE, de privado/viaje.js): días, lugares, mapas, billetes y enlaces a Google Maps.
// Sin DOM: tools/mapas.js también lo usa (desde Node) para saber qué mapas tiene que dibujar.
const Datos = (() => {
  const V = VIAJE;
  // Archivos (capturas de mapas y billetes): tools/build.js los mete en ARCHIVOS como data: URI. Sin compilar
  // (abriendo app/index.html), se leen directamente de la carpeta privado/.
  const ARCH = typeof ARCHIVOS !== 'undefined' ? ARCHIVOS : null;

  const dias = V.dias;
  const dia = fecha => dias.find(d => d.fecha === fecha);
  const indice = fecha => dias.findIndex(d => d.fecha === fecha);
  const excursion = id => V.excursiones.find(e => e.id === id);
  // Un lugar del plan. 'aloj:<clave>' es un alojamiento: se busca por su dirección y sale con una casa en el mapa.
  function lugar(id) {
    if (String(id).startsWith('aloj:')) {
      const a = V.alojamientos[id.slice(5)];
      return a ? { nombre: a.nombre, q: a.q || a.direccion, lat: a.lat, lon: a.lon, casa: true } : { nombre: id };
    }
    return V.lugares[id] || { nombre: id };
  }
  const existeLugar = id => (String(id).startsWith('aloj:') ? Boolean(V.alojamientos[id.slice(5)]) : Boolean(V.lugares[id]));
  const zona = id => V.zonas[id] || { nombre: id, color: '#888' };
  const billete = id => V.billetes.find(b => b.id === id);
  const guia = id => (V.guias || []).find(g => g.id === id);
  const bloque = fecha => V.bloques.find(b => fecha >= b.desde && fecha <= b.hasta);
  const alojamiento = id => (V.alojamientos[id] || { nombre: id });
  // Dónde dormimos la noche de un día: el último alojamiento que empieza ese día o antes.
  function duerme(fecha) {
    let clave = null;
    dias.forEach(d => { if (d.fecha <= fecha && d.alojamiento) clave = d.alojamiento; });
    return clave;
  }
  // Dónde nos levantamos: donde dormimos la noche anterior (el primer día, en ninguno).
  function despierta(fecha) {
    const i = indice(fecha);
    return i > 0 ? duerme(dias[i - 1].fecha) : null;
  }
  // Noches de cada alojamiento: [{ clave, desde, hasta }] (hasta = día de salida).
  function estancias() {
    const out = [];
    dias.forEach(d => {
      if (d.fecha === V.fin) return;
      const clave = duerme(d.fecha), ultima = out[out.length - 1];
      if (!clave) return;
      if (ultima && ultima.clave === clave) ultima.hasta = dias[indice(d.fecha) + 1].fecha;
      else out.push({ clave, desde: d.fecha, hasta: dias[indice(d.fecha) + 1].fecha });
    });
    return out;
  }
  // Días en los que sale una excursión.
  const diasDe = idExcursion => dias.filter(d => (d.excursiones || []).includes(idExcursion));

  // Lugares de un día o excursión, en el orden del plan y sin repetir.
  function lugaresDe(entidad) {
    const ids = [];
    entidad.plan.forEach(paso => (paso.lugares || []).forEach(id => { if (!ids.includes(id)) ids.push(id); }));
    return ids;
  }

  // Mapas de un día (clave = fecha) o de una excursión (clave = exc-<id>): [{ id, titulo, puntos }].
  // Sin `mapas`, uno con todos los lugares del plan que tienen coordenadas. Los números siguen de un mapa al
  // siguiente, y son los mismos que salen en el plan.
  function mapas(entidad, clave) {
    const defs = entidad.mapas || [{ titulo: '', lugares: lugaresDe(entidad) }];
    let n = 0;
    const lista = defs.map((def, i) => {
      const puntos = def.lugares
        .filter(id => lugar(id).lat != null)
        .map(id => ({ id, ...lugar(id), n: lugar(id).casa ? null : ++n }));
      return { id: defs.length > 1 ? `${clave}-${i + 1}` : clave, titulo: def.titulo, puntos };
    });
    return lista.filter(mapa => mapa.puntos.length);
  }
  const mapasDia = d => mapas(d, d.fecha);
  const mapasExcursion = e => mapas(e, 'exc-' + e.id);
  // { idLugar: número } de todos los mapas de una entidad.
  function numeros(lista) {
    const out = {};
    lista.forEach(mapa => mapa.puntos.forEach(p => { if (p.n) out[p.id] = p.n; }));
    return out;
  }
  // Todos los mapas del viaje, con su color (para tools/mapas.js).
  function todosLosMapas() {
    const out = [];
    dias.forEach(d => mapasDia(d).forEach(m => out.push({ ...m, color: zona(d.zona).color })));
    V.excursiones.forEach(e => mapasExcursion(e).forEach(m => out.push({ ...m, color: zona(e.zona).color })));
    return out;
  }

  // ---------- Archivos ----------
  const archivo = ruta => (ARCH ? ARCH[ruta] : '../privado/' + ruta);
  const imagenMapa = idMapa => archivo(`mapas/${idMapa}.webp`);

  // Archivos de un billete: `archivo` (uno) o `archivos` (varios, p. ej. uno por persona), como texto o
  // { ruta, nombre }. Devuelve [{ ruta, nombre, url }].
  function archivosBillete(b) {
    const lista = b.archivos || (b.archivo ? [b.archivo] : []);
    return lista.map(a => (typeof a === 'string' ? { ruta: a } : a))
      .map(a => ({ ...a, nombre: a.nombre || a.ruta.split('/').pop(), url: archivo(a.ruta) }));
  }

  // ¿Se reparte entre el grupo (un archivo por persona, con nombre y «usado»)? Sí si hay varios archivos, salvo que
  // el billete diga reparto: false (p. ej. los dos coches).
  const reparte = b => archivosBillete(b).length > 1 && b.reparto !== false;

  // Billetes de un día: los que el plan nombra y los que tienen esa fecha.
  function billetesDia(d) {
    const ids = [];
    d.plan.forEach(paso => { if (paso.billete && !ids.includes(paso.billete)) ids.push(paso.billete); });
    V.billetes.forEach(b => { if (b.fecha === d.fecha && !ids.includes(b.id)) ids.push(b.id); });
    return ids.map(billete).filter(Boolean);
  }

  // ---------- Google Maps ----------
  const consulta = id => lugar(id).q || lugar(id).nombre;
  // Un lugar puede traer su propio enlace de Google Maps (url); si no, se busca por q o por el nombre.
  const urlLugar = id => lugar(id).url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta(id));
  // Ruta con las paradas en orden (Google admite hasta 9 paradas intermedias). modo: 'driving' o nada (el transporte
  // público de Google no admite paradas intermedias; sin modo, Google enseña la ruta y se puede cambiar allí).
  function urlRuta(ids, modo) {
    if (ids.length === 1) return urlLugar(ids[0]);
    const enc = id => encodeURIComponent(consulta(id));
    const paradas = ids.slice(1, -1).slice(0, 9).map(enc).join('%7C');
    return 'https://www.google.com/maps/dir/?api=1&origin=' + enc(ids[0])
      + '&destination=' + enc(ids[ids.length - 1])
      + (paradas ? '&waypoints=' + paradas : '')
      + (modo ? '&travelmode=' + modo : '');
  }
  const modo = zonaId => (zonaId === 'coche' ? 'driving' : null);
  // Mapa de Google My Maps del viaje (VIAJE.mapaGoogle, cualquier enlace suyo): { embed, abrir } o null.
  function mapaGoogle() {
    const mid = /[?&]mid=([\w-]+)/.exec(V.mapaGoogle || '');
    if (!mid) return null;
    return {
      embed: 'https://www.google.com/maps/d/embed?mid=' + mid[1],
      abrir: 'https://www.google.com/maps/d/viewer?mid=' + mid[1],
    };
  }
  // Cómo llegar a un sitio desde donde estés (Google pone tu ubicación como origen).
  const urlComoLlegar = (id, modoViaje) => 'https://www.google.com/maps/dir/?api=1&destination='
    + encodeURIComponent(consulta(id)) + '&travelmode=' + (modoViaje || 'transit');

  // Ruta completa de un día de coche: del alojamiento donde nos levantamos, por todas las paradas del plan, hasta
  // donde dormimos (o hasta d.rutaCoche.hasta / desde). Ids de lugares, o null si el día no es de coche.
  function rutaCoche(d) {
    if (d.zona !== 'coche') return null;
    const opciones = d.rutaCoche || {};
    const desde = opciones.desde || (despierta(d.fecha) && 'aloj:' + despierta(d.fecha));
    const hasta = opciones.hasta || (duerme(d.fecha) && 'aloj:' + duerme(d.fecha));
    const paradas = lugaresDe(d).filter(id => !id.startsWith('aloj:') && id !== hasta && id !== desde);
    return [desde, ...paradas, hasta].filter(Boolean);
  }

  return {
    V, dias, dia, indice, excursion, lugar, existeLugar, zona, billete, guia, bloque, alojamiento, diasDe,
    duerme, despierta, estancias, rutaCoche,
    lugaresDe, mapasDia, mapasExcursion, numeros, todosLosMapas,
    archivo, imagenMapa, archivosBillete, reparte, billetesDia,
    urlLugar, urlRuta, urlComoLlegar, modo, mapaGoogle,
  };
})();
