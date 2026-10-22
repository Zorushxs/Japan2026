// Pantalla de inicio (#/): cuenta atrás, calendario de los meses del viaje con el color de cada zona y la lista
// de días por bloques.
const Calendario = (() => {
  const { html, rich } = U;
  const V = Datos.V;

  function render(root) {
    U.onActions(root, {
      // Sin elegir, tocar un avatar te elige; ya elegido, tocar otro pide confirmar con la ventana.
      'soy-yo': el => {
        if (!Billetes.soy()) { Billetes.ponerSoy(el.dataset.nombre); App.refresh(); }
        else if (el.dataset.nombre !== Billetes.soy()) Billetes.elegirSoy();
      },
      'cambiar-yo': () => Billetes.elegirSoy(),
    });
    root.innerHTML = html`
      <h1 class="h">${V.titulo}</h1>
      <p class="sub-h">${U.fmtShort(V.inicio)} – ${U.fmtShort(V.fin)} · ${Datos.dias.length} días</p>
      ${estado()}
      <div class="leyenda">${Object.keys(V.zonas).map(Piezas.zona)}</div>
      ${grupo()}
      ${meses().map(mes)}
      <h2 class="h2">Día a día</h2>
      ${V.bloques.map(bloque)}
      <a class="link-info" href="#/info">${U.ICON.info}<span>Notas del plan, guías y consejos</span></a>`;
  }

  // Franja con los avatares del grupo, justo encima del calendario. El tuyo sale marcado; si en este móvil aún no has
  // dicho quién eres, te lo pide (y basta con tocar tu avatar). «Cambiar» por si te has equivocado.
  let preguntado = false; // la ventana se abre sola una vez por sesión
  function grupo() {
    const nombres = V.grupo || [];
    if (!nombres.length) return '';
    const yo = Billetes.soy();
    if (!yo && !preguntado) {
      preguntado = true;
      setTimeout(() => { if (App.pantalla() === Calendario && !Billetes.soy()) Billetes.elegirSoy(); }, 500);
    }
    return html`<section class="grupo ${yo ? '' : 'sin-yo'}">
      <div class="grupo-cab">
        ${yo ? html`<p>Eres <b>${yo}</b></p><button type="button" class="btn-ruta" data-act="cambiar-yo">Cambiar</button>`
          : html`<p class="grupo-pide">👋 <b>¿Quién eres?</b> Toca tu avatar</p>`}
      </div>
      <div class="grupo-caras">${nombres.map(n => html`<button type="button" class="cara ${n === yo ? 'yo-cara' : ''}"
          data-act="soy-yo" data-nombre="${n}" aria-pressed="${n === yo}" aria-label="${n}">
          ${Piezas.avatar(n)}<span>${n === yo ? 'Tú' : n}</span></button>`)}</div>
    </section>`;
  }

  // «Faltan 4 días», «Día 3 de 21» o «Viaje terminado».
  function estado() {
    const hoy = U.today();
    if (hoy < V.inicio) {
      const faltan = U.daysBetween(hoy, V.inicio);
      return html`<p class="cuenta">Faltan <b>${faltan}</b> ${faltan === 1 ? 'día' : 'días'}</p>`;
    }
    if (hoy <= V.fin) {
      return html`<p class="cuenta"><a href="#/dia/${hoy}">Hoy es el día <b>${Datos.indice(hoy) + 1}</b> de
        ${Datos.dias.length} →</a></p>`;
    }
    return html`<p class="cuenta">Viaje terminado</p>`;
  }

  // Meses que toca el viaje: [{ year, month }].
  function meses() {
    const out = [];
    const desde = U.parse(V.inicio), hasta = U.parse(V.fin);
    for (let d = new Date(desde.getFullYear(), desde.getMonth(), 1); d <= hasta; d.setMonth(d.getMonth() + 1)) {
      out.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return out;
  }

  // Un mes en cuadrícula, empezando en lunes.
  function mes({ year, month }) {
    const primero = new Date(year, month, 1);
    const huecos = (primero.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const celdas = [];
    for (let i = 0; i < huecos; i++) celdas.push(html`<span class="cel vacia"></span>`);
    for (let n = 1; n <= total; n++) celdas.push(celda(U.iso(new Date(year, month, n)), n));
    return html`<section class="mes">
      <h2 class="mes-t">${U.monthName(month)} ${year}</h2>
      <div class="sem">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(l => html`<span>${l}</span>`)}</div>
      <div class="grid">${celdas}</div>
    </section>`;
  }

  function celda(fecha, n) {
    const d = Datos.dia(fecha);
    const hoy = fecha === U.today() ? ' hoy' : '';
    if (!d) return html`<span class="cel${hoy}">${n}</span>`;
    return html`<a class="cel viaje${hoy}${d.porDefinir ? ' por-definir' : ''}" href="#/dia/${fecha}"
      style="--z:${Datos.zona(d.zona).color}" aria-label="${U.fmtLong(fecha)}: ${d.titulo}">${n}</a>`;
  }

  // Un bloque del viaje con sus días.
  function bloque(b) {
    const dias = Datos.dias.filter(d => d.fecha >= b.desde && d.fecha <= b.hasta);
    return html`<section class="bloque">
      <h3>${b.titulo}</h3>
      ${b.nota ? html`<p class="hint">${rich(b.nota)}</p>` : ''}
      <ul class="lista-dias">${dias.map(fila)}</ul>
    </section>`;
  }

  function fila(d) {
    const fecha = U.parse(d.fecha);
    const billetes = Datos.billetesDia(d);
    return html`<li><a class="fila${d.fecha === U.today() ? ' hoy' : ''}" href="#/dia/${d.fecha}"
        style="--z:${Datos.zona(d.zona).color}">
      <span class="fila-fecha"><small>${U.dowShort(d.fecha)}</small><b>${fecha.getDate()}</b></span>
      <span class="fila-txt">
        <b>${d.titulo}</b>
        <small>${Datos.zona(d.zona).nombre}${d.porDefinir ? ' · por definir' : ''}${d.alojamiento
          ? ' · ' + Datos.alojamiento(d.alojamiento).nombre : ''}</small>
      </span>
      ${billetes.length ? html`<span class="fila-ico" title="Billetes">${U.ICON.ticket}</span>` : ''}
    </a></li>`;
  }

  return { nav: 'calendario', render };
})();
