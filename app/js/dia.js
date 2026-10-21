// Un día (#/dia/AAAA-MM-DD): alojamiento, equipaje, mapas, plan, billetes y excursiones. Se pasa de día con
// las flechas (también las del teclado) y, en el móvil, deslizando el dedo.
const Dia = (() => {
  const { html, rich, ICON } = U;
  let actual = null;

  function render(root, fecha) {
    const d = Datos.dia(fecha) || Datos.dias[0];
    actual = d;
    const i = Datos.indice(d.fecha);
    const anterior = Datos.dias[i - 1], siguiente = Datos.dias[i + 1];
    const mapas = Datos.mapasDia(d);
    const numeros = Datos.numeros(mapas);
    const billetes = Datos.billetesDia(d);
    const bloque = Datos.bloque(d.fecha);
    root.innerHTML = html`
      <div class="dia" style="--z:${Datos.zona(d.zona).color}">
        <div class="dia-nav">
          ${flecha(anterior, 'left', 'Día anterior')}
          <div class="dia-cab">
            <small>${bloque ? bloque.titulo : ''}</small>
            <span class="dia-fecha">${U.fmtLong(d.fecha)}</span>
            <small>Día ${i + 1} de ${Datos.dias.length}${d.fecha === U.today() ? ' · hoy' : ''}</small>
          </div>
          ${flecha(siguiente, 'right', 'Día siguiente')}
        </div>
        <h1 class="h dia-titulo">${d.titulo}</h1>
        <div class="row">${Piezas.zona(d.zona)}${d.porDefinir ? html`<span class="tag-def">Por definir</span>` : ''}</div>
        ${guias(d)}
        ${billetes.length ? html`<div class="billetes billetes-dia">${billetes.map(Piezas.billete)}</div>` : ''}
        ${estancia(d)}
        ${rutaCoche(d)}
        ${mapas.map(m => Piezas.mapa(m, Datos.modo(d.zona)))}
        ${Piezas.cabeceraPlan()}
        ${Piezas.plan(d.plan, numeros)}
        ${excursiones(d)}
      </div>`;
  }

  const flecha = (dia, icono, label) => (dia
    ? html`<a class="icon-btn" href="#/dia/${dia.fecha}" data-replace aria-label="${label}">${ICON[icono]}</a>`
    : html`<span class="icon-btn off" aria-hidden="true">${ICON[icono]}</span>`);

  // Dónde dormimos (o, el último día, de dónde salimos) y el equipaje.
  function estancia(d) {
    const equipaje = d.equipaje
      ? html`<p class="equipaje">${ICON.bag}<span><b>Equipaje:</b> ${rich(d.equipaje)}</span></p>` : '';
    const modoViaje = d.zona === 'coche' ? 'driving' : 'transit';
    const ultimo = d.fecha === Datos.V.fin;
    const clave = ultimo ? Datos.despierta(d.fecha) : Datos.duerme(d.fecha);
    if (!clave) return equipaje ? html`<div class="estancia">${equipaje}</div>` : '';
    const cambia = !ultimo && clave !== Datos.despierta(d.fecha);
    const etiqueta = ultimo ? 'Check-out' : cambia ? 'Alojamiento nuevo · check-in' : 'Dormimos en';
    return Piezas.alojamiento(clave, etiqueta, modoViaje, equipaje);
  }

  // Días de coche: la ruta entera en Google Maps (del alojamiento, por todas las paradas, hasta el siguiente).
  function rutaCoche(d) {
    const ruta = Datos.rutaCoche(d);
    if (!ruta || ruta.length < 2) return '';
    return html`<a class="btn ruta-dia" href="${Datos.urlRuta(ruta, 'driving')}" target="_blank" rel="noopener">
      ${ICON.route}<span>Ruta completa del día en coche</span></a>`;
  }

  // Las guías del día (p. ej. el envío de maletas) van arriba del todo y destacadas: son lo que no se puede olvidar.
  function guias(d) {
    const lista = (d.guias || []).map(Datos.guia).filter(Boolean);
    if (!lista.length) return '';
    return html`<div class="guias-dia">${lista.map(g => Piezas.guia(g, true))}</div>`;
  }

  function excursiones(d) {
    const lista = (d.excursiones || []).map(Datos.excursion).filter(Boolean);
    if (!lista.length) return '';
    return html`<h2 class="h2">${lista.length > 1 ? 'Excursiones' : 'Excursión'}</h2>
      <div class="excs">${lista.map(Piezas.excursion)}</div>`;
  }

  // Ir al día de al lado sin llenar el historial.
  function mover(paso) {
    if (!actual) return;
    const dia = Datos.dias[Datos.indice(actual.fecha) + paso];
    if (dia) App.replace('#/dia/' + dia.fecha);
  }

  function key(e) {
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
  }

  // Deslizar el dedo en horizontal (y no en vertical) cambia de día.
  let inicio = null;
  document.addEventListener('touchstart', e => {
    if (App.pantalla() !== Dia || e.touches.length !== 1 || e.target.closest('.mapa-img, .chips')) return;
    inicio = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!inicio) return;
    const dx = e.changedTouches[0].clientX - inicio.x, dy = e.changedTouches[0].clientY - inicio.y;
    inicio = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) mover(dx < 0 ? 1 : -1);
  }, { passive: true });

  return { nav: 'dia', render, key };
})();
