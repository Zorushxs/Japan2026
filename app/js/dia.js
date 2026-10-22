// Un día (#/dia/AAAA-MM-DD): alojamiento, equipaje, mapas, plan, billetes y excursiones. Se pasa de día con
// las flechas (también las del teclado) y, en el móvil, deslizando el dedo.
const Dia = (() => {
  const { html, rich, ICON } = U;
  let actual = null;

  function render(root, fecha) {
    const d = Datos.dia(fecha) || Datos.dias[0];
    // Si venimos de otro día, el nuevo entra deslizándose desde el lado que toca.
    const venia = /^#\/dia\//.test(App.anterior() || '');
    const desde = venia && actual && actual.fecha !== d.fecha ? (d.fecha > actual.fecha ? 'der' : 'izq') : '';
    actual = d;
    const i = Datos.indice(d.fecha);
    const anterior = Datos.dias[i - 1], siguiente = Datos.dias[i + 1];
    const mapas = Datos.mapasDia(d);
    const numeros = Datos.numeros(mapas);
    const billetes = Datos.billetesDia(d);
    const bloque = Datos.bloque(d.fecha);
    root.innerHTML = html`
      <div class="dia ${desde ? 'entra-' + desde : ''}" style="--z:${Datos.zona(d.zona).color}">
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

  // Deslizar el dedo en horizontal: la tarjeta del día sigue al dedo; al soltar, si se ha deslizado bastante, sale por
  // ese lado y entra el día siguiente (o el anterior) por el contrario; si no, vuelve a su sitio. En el primer y el
  // último día se estira un poco y rebota.
  let gesto = null;
  const tarjeta = () => document.querySelector('#view .dia');
  document.addEventListener('touchstart', e => {
    if (App.pantalla() !== Dia || e.touches.length !== 1 || e.target.closest('.mapa-img, .chips, dialog')) return;
    gesto = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, eje: null, el: tarjeta() };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!gesto || !gesto.el) return;
    const dx = e.touches[0].clientX - gesto.x, dy = e.touches[0].clientY - gesto.y;
    if (!gesto.eje && Math.hypot(dx, dy) > 10) gesto.eje = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    if (gesto.eje !== 'h') return;
    const hay = Datos.dias[Datos.indice(actual.fecha) + (dx < 0 ? 1 : -1)];
    gesto.dx = hay ? dx : dx * 0.25; // sin día al otro lado, se resiste
    gesto.el.style.transition = 'none';
    gesto.el.style.transform = `translateX(${gesto.dx}px) rotate(${gesto.dx / 60}deg)`;
    gesto.el.style.opacity = String(1 - Math.min(Math.abs(gesto.dx) / 700, 0.35));
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!gesto) return;
    const { dx, eje, el } = gesto;
    gesto = null;
    if (eje !== 'h' || !el) return;
    const paso = dx < 0 ? 1 : -1;
    const hay = Datos.dias[Datos.indice(actual.fecha) + paso];
    if (hay && Math.abs(dx) > 70) {
      el.style.transition = 'transform .2s cubic-bezier(.4, 0, 1, 1), opacity .2s';
      el.style.transform = `translateX(${dx < 0 ? -110 : 110}%) rotate(${dx < 0 ? -4 : 4}deg)`;
      el.style.opacity = '0';
      setTimeout(() => mover(paso), 170);
    } else {
      el.style.transition = 'transform .35s cubic-bezier(.2, 1.4, .4, 1), opacity .25s';
      el.style.transform = '';
      el.style.opacity = '';
    }
  }, { passive: true });

  return { nav: 'dia', render, key };
})();
