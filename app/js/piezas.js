// Trozos de HTML que comparten las pantallas: el plan (pasos con hora), los mapas, los billetes y las excursiones.
const Piezas = (() => {
  const { html, rich, ICON } = U;

  const ETIQUETAS = {
    info: 'Info', tiempo: 'Tiempo', aviso: 'Ojo', importante: 'Importante', opcional: 'Opcional',
    alternativa: 'Alternativa',
  };

  // Chip de un lugar: número del mapa (si sale en él) y enlace a Google Maps.
  function chipLugar(id, numeros) {
    const casa = Datos.lugar(id).casa;
    const icono = casa ? html`<b class="num casa">${ICON.home}</b>` : numeros[id] ? html`<b class="num">${numeros[id]}</b>` : ICON.pin;
    return html`<a class="lugar" href="${Datos.urlLugar(id)}" target="_blank" rel="noopener">
      ${icono}<span>${Datos.lugar(id).nombre}</span></a>`;
  }

  const chipBillete = id => {
    const b = Datos.billete(id);
    if (!b) return '';
    // Un billete que es solo de otros no sale en el paso (está en la lista de billetes del día, atenuado).
    if (!Datos.esPara(b, Billetes.soy())) return '';
    const tiene = Datos.archivosBillete(b).length > 0;
    return html`<a class="chip-billete ${tiene ? '' : 'falta'}" href="#/billetes/${b.id}">
      ${ICON.ticket}<span>${b.titulo}</span>${tiene ? '' : html`<em>pendiente</em>`}</a>`;
  };

  // ---------- Resumen o detalle ----------
  // «resumen»: solo los pasos con `corto`, en una línea. «detalle»: el texto entero, con las notas, los subpuntos y
  // qué es cada sitio.
  // Siempre empieza en «detalle»; «resumen» dura mientras la app esté abierta (no se guarda).
  let modoActual = 'detalle';
  try { localStorage.removeItem('viaje:modo'); } catch {} // lo que guardaban las versiones anteriores
  const modo = () => modoActual;
  function cambiarModo(nuevo) {
    modoActual = nuevo === 'resumen' ? 'resumen' : 'detalle';
  }
  // «Plan» con los botones Resumen | Detalle (App los atiende con data-modo).
  const cabeceraPlan = () => html`<div class="plan-cab">
    <h2 class="h2">Plan</h2>
    <div class="seg" role="group" aria-label="Cómo ver el plan">
      ${['resumen', 'detalle'].map(m => html`<button type="button" data-modo="${m}" aria-pressed="${modo() === m}">
        ${m === 'resumen' ? 'Resumen' : 'Detalle'}</button>`)}
    </div>
  </div>`;

  // Qué es cada sitio del paso (solo en detalle).
  function infoLugares(lugares) {
    const conInfo = lugares.filter(id => Datos.lugar(id).info);
    if (!conInfo.length) return '';
    return html`<div class="lugar-info">${conInfo.map(id =>
      html`<p><b>${Datos.lugar(id).nombre}:</b> ${rich(Datos.lugar(id).info)}</p>`)}</div>`;
  }

  // Un paso del plan. Los de tipo «tiempo» son una línea pequeña entre dos pasos. En resumen solo salen los que
  // tienen `corto`, con ese texto.
  function paso(p, numeros) {
    const resumen = modo() === 'resumen';
    if (resumen && !p.corto) return '';
    const texto = resumen ? p.corto : p.texto;
    const lugares = p.lugares || [];
    const enlaces = p.enlaces || [];
    const billetes = [].concat(p.billete || []);
    const extra = lugares.length || billetes.length || enlaces.length
      ? html`<div class="chips">${lugares.map(id => chipLugar(id, numeros))}${billetes.map(chipBillete)}
        ${enlaces.map(e => html`<a class="lugar enlace" href="${e.url}" target="_blank" rel="noopener">${ICON.out}<span>${e.texto}</span></a>`)}</div>`
      : '';
    if (p.tipo === 'tiempo') return html`<li class="paso tiempo"><p>${rich(texto)}</p></li>`;
    const contenido = html`
        <p>${rich(texto)}</p>
        ${p.sub && !resumen ? html`<ul class="sub">${p.sub.map(s => html`<li>${rich(s)}</li>`)}</ul>` : ''}
        ${extra}
        ${resumen ? '' : infoLugares(lugares)}`;
    // Un paso solo de algunos (`para`) o de todos menos algunos (`excepto`): plegado para quien no va, abierto para
    // quien sí (o si no has dicho quién eres).
    const yo = Billetes.soy();
    const parcial = p.para || p.excepto;
    const va = !parcial || !yo || (p.para ? p.para.includes(yo) : !p.excepto.includes(yo));
    const quien = p.para
      ? html`<span class="paso-de-quien">${p.para.map(n => avatar(n, 'mini'))}</span>`
      : p.excepto ? html`<small class="paso-sin">Sin ${p.excepto.join(' ni ')}</small>` : '';
    // A quien va a un paso de «todos menos…» se le enseña normal (la etiqueta solo le sirve a quien no va).
    const cuerpo = parcial && !(p.excepto && va)
      ? html`<details class="paso-de" ${va ? U.raw('open') : ''}>
          <summary>${quien}<span>${rich(p.corto || p.texto)}</span></summary>
          ${contenido}
        </details>`
      : contenido;
    return html`<li class="paso ${p.tipo ? 'nota nota-' + p.tipo : ''}">
      ${p.hora ? html`<span class="hora">${p.hora}</span>` : ''}
      <div class="cuerpo">
        ${p.tipo && !parcial ? html`<span class="etiqueta">${ETIQUETAS[p.tipo] || p.tipo}</span>` : ''}
        ${cuerpo}
      </div>
    </li>`;
  }

  const plan = (pasos, numeros) => html`<ol class="plan ${modo()}">${pasos.map(p => paso(p, numeros))}</ol>`;

  // Captura del mapa: al tocarla, abre la ruta en Google Maps. Si la captura no existe todavía, solo queda el botón.
  function mapa(m, modo) {
    const ruta = Datos.urlRuta(m.puntos.map(p => p.id), modo);
    const src = Datos.imagenMapa(m.id);
    return html`<figure class="mapa">
      ${src ? html`<a href="${ruta}" target="_blank" rel="noopener" class="mapa-img">
        <img src="${src}" alt="Mapa: ${m.puntos.map(p => p.n + '. ' + p.nombre).join(', ')}" loading="lazy"
          onerror="this.closest('.mapa-img').remove()"></a>` : ''}
      <figcaption>
        ${m.titulo ? html`<b>${m.titulo}</b>` : ''}
        <a class="btn-ruta" href="${ruta}" target="_blank" rel="noopener">${ICON.route}<span>Ruta en Google Maps</span></a>
      </figcaption>
    </figure>`;
  }

  // Tarjeta de un billete, con su estado.
  function billete(b, ajeno) {
    const archivos = Datos.archivosBillete(b);
    const tiene = archivos.length > 0;
    const estados = archivos.map(a => Sincro.item(Sincro.clave(b, a)));
    const reparto = Datos.reparte(b)
      ? ` · ${estados.filter(e => e.nombre).length}/${archivos.length} con nombre · ${estados.filter(e => e.usado).length} ${Billetes.textos(b).usados}`
      : '';
    return html`<a class="billete ${tiene ? '' : 'falta'} ${ajeno ? 'ajeno' : ''}" href="#/billetes/${b.id}">
      <span class="billete-ico">${ICON.ticket}</span>
      <span class="billete-txt">${ajeno ? html`<small class="de-otros">De otros:</small>` : ''}<b>${b.titulo}</b>
        <small>${U.fmtShort(b.fecha)}${b.hora ? ' · ' + b.hora : ''}${reparto}</small>
        ${Datos.reparte(b) && Billetes.miAsiento(b) ? html`<em class="mi-asiento">Tu ${Billetes.textos(b).cosa}: ${Billetes.miAsiento(b)}</em>` : ''}</span>
      ${b.para ? html`<span class="billete-quien">${b.para.map(n => avatar(n, 'mini'))}</span>` : ''}
      <span class="billete-estado">${tiene || b.tramos ? 'Ver' : 'Pendiente'}</span>
    </a>`;
  }

  // Lista de billetes por orden: los que son solo de otros se quedan en su sitio, pero atenuados y más pequeños.
  function billetesDe(lista) {
    const yo = Billetes.soy();
    return html`<div class="billetes">${lista.map(b => billete(b, !Datos.esPara(b, yo)))}</div>`;
  }

  // Tarjeta de una excursión (con la miniatura de su primer mapa, si la hay).
  function excursion(e) {
    const primer = Datos.mapasExcursion(e)[0];
    const src = primer && Datos.imagenMapa(primer.id);
    return html`<a class="exc" href="#/excursion/${e.id}" style="--z:${Datos.zona(e.zona).color}">
      ${src ? html`<img class="exc-img" src="${src}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <span class="exc-txt">
        <span class="exc-top">${e.letra ? html`<b class="exc-letra">${e.letra}</b>` : ''}
          ${e.prioridad ? html`<small>Prioridad ${e.prioridad}</small>` : ''}</span>
        <b class="exc-titulo">${e.emoji} ${e.titulo}</b>
        <small>${e.resumen}</small>
      </span>
    </a>`;
  }

  // Tarjeta de un alojamiento: nombre, dirección, notas y botones para verlo o ir en Google Maps.
  // etiqueta: «Alojamiento nuevo», «Dormimos en»…; extra: HTML que va al final (p. ej. el equipaje).
  function alojamiento(clave, etiqueta, modoViaje, extra) {
    const a = Datos.alojamiento(clave), id = 'aloj:' + clave;
    return html`<div class="estancia">
      <p class="estancia-cab">${ICON.home}<span><small>${etiqueta}</small><b>${a.nombre}</b></span></p>
      ${a.direccion ? html`<p class="direccion">${a.direccion}</p>` : ''}
      ${a.notas ? html`<p class="estancia-nota">${rich(a.notas)}</p>` : ''}
      <div class="row">
        <a class="btn-ruta" href="${Datos.urlLugar(id)}" target="_blank" rel="noopener">${ICON.pin}<span>Ver en Google Maps</span></a>
        <a class="btn-ruta" href="${Datos.urlComoLlegar(id, modoViaje)}" target="_blank" rel="noopener">${ICON.route}<span>Cómo llegar</span></a>
      </div>
      ${extra || ''}
    </div>`;
  }

  // Tarjeta de una guía (p. ej. el envío de maletas). destacada: con el color de aviso, para lo importante del día.
  const guia = (g, destacada) => html`<a class="billete ${destacada ? 'guia-destacada' : ''}" href="#/guia/${g.id}">
    <span class="billete-ico">${g.emoji}</span>
    <span class="billete-txt"><b>${g.titulo}</b>${g.resumen ? html`<small>${rich(g.resumen)}</small>` : ''}</span>
    <span class="billete-estado">Ver</span>
  </a>`;

  // Avatar de una persona: su foto (VIAJE.avatares) o su inicial en un círculo de color. Cada persona del grupo tiene
  // un color distinto (por su orden en VIAJE.grupo); alguien de fuera, uno que sale de su nombre.
  const ESTRELLA = '<svg viewBox="0 0 10 10"><path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z"/></svg>';
  const DORADO = U.raw(`<span class="destello" aria-hidden="true"></span>
    <svg class="corona" viewBox="0 0 24 17" aria-hidden="true">
      <defs><linearGradient id="oro-corona" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#f1c84b"/><stop offset="1" stop-color="#9b6a14"/>
      </linearGradient></defs>
      <path d="M2.2 13.2L1 4.2l6 4.2L12 1.2l5 7.2 6-4.2-1.2 9z" fill="url(#oro-corona)" stroke="#6e4a0c" stroke-width=".7"
        stroke-linejoin="round"/>
      <rect x="2" y="12.6" width="20" height="3.2" rx="1" fill="url(#oro-corona)" stroke="#6e4a0c" stroke-width=".7"/>
      <circle cx="12" cy="9.6" r="1.7" fill="#d4213a" stroke="#6b0f1d" stroke-width=".5"/>
      <circle cx="6.6" cy="10.6" r="1" fill="#2d6fd6"/><circle cx="17.4" cy="10.6" r="1" fill="#2d6fd6"/>
      <circle cx="1" cy="4.2" r="1" fill="#fff6c8"/><circle cx="12" cy="1.2" r="1.1" fill="#fff6c8"/>
      <circle cx="23" cy="4.2" r="1" fill="#fff6c8"/>
    </svg>
    <span class="chispa c1" aria-hidden="true">${ESTRELLA}</span>
    <span class="chispa c2" aria-hidden="true">${ESTRELLA}</span>
    <span class="chispa c3" aria-hidden="true">${ESTRELLA}</span>`);
  // Marco «nika» (Gear 5): sol de Nika encima y nubes que flotan alrededor.
  const NIKA = U.raw(`<svg class="sol-nika" viewBox="0 0 40 40" aria-hidden="true">
      <g fill="#ffd23f" stroke="#c77d0a" stroke-width="1">
        ${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30} 20 20)" d="M20 1.5 L22.6 10 L17.4 10 Z"/>`).join('')}
      </g>
      <circle cx="20" cy="20" r="9" fill="#fff6d8" stroke="#c77d0a" stroke-width="1.2"/>
      <circle cx="16.8" cy="18.6" r="1.4" fill="#3a2a10"/><circle cx="23.2" cy="18.6" r="1.4" fill="#3a2a10"/>
      <path d="M15.5 22 Q20 27 24.5 22" fill="none" stroke="#3a2a10" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
    <span class="nube n1" aria-hidden="true"></span><span class="nube n2" aria-hidden="true"></span>
    <span class="nube n3" aria-hidden="true"></span>`);
  // Marco «zoro»: el dorado y, encima, tres tajos de katana que se dibujan uno tras otro formando una Z.
  const ZORO = U.raw(`<svg class="tajos" viewBox="0 0 100 100" aria-hidden="true">
      <path class="t1" pathLength="1" d="M22 27 L80 23"/>
      <path class="t2" pathLength="1" d="M80 25 L20 76"/>
      <path class="t3" pathLength="1" d="M20 77 L80 73"/>
    </svg>`);
  // Marco «oscuro»: plumas de cuervo que se desprenden y caen balanceándose.
  const PLUMA = `<svg viewBox="0 0 20 40"><defs><linearGradient id="pluma-cuervo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a5aa0"/><stop offset=".5" stop-color="#241e30"/><stop offset="1" stop-color="#4a3a60"/>
    </linearGradient></defs>
    <path d="M10 1C16.5 7 17.5 19 11.5 34L10 39 8.5 34C2.5 19 3.5 7 10 1Z" fill="url(#pluma-cuervo)" stroke="#cbb8e6"
      stroke-width=".8"/>
    <path d="M10 4V39M10 12 14 9M10 17 15 13M10 22 14.5 18M10 13 6 10M10 19 5.5 15M10 25 6 21" stroke="#cbb8e6"
      stroke-width=".7" fill="none"/></svg>`;
  const OSCURO = U.raw(`<span class="sello" lang="ja" aria-hidden="true">鴉</span>
    <span class="pluma p1" aria-hidden="true">${PLUMA}</span><span class="pluma p2" aria-hidden="true">${PLUMA}</span>`);
  const COLORES = ['#d64545', '#2f8f5b', '#3a6fd8', '#c27c0e', '#8a4fd0', '#0f8a8a', '#d0477f', '#5b6b2f', '#7a5230'];
  function avatar(nombre, clase) {
    const marco = (Datos.V.marcos || {})[nombre];
    const dentro = avatarSolo(nombre, clase);
    // El marco oscuro lleva además un sello japonés (hanko) con 鴉, «cuervo»; el dorado, el destello que recorre el
    // anillo, una corona de oro y tres chispas.
    const extra = marco === 'oscuro' ? OSCURO
      : marco === 'dorado' ? DORADO : marco === 'nika' ? NIKA : marco === 'zoro' ? html`${DORADO}${ZORO}` : '';
    const clases = marco === 'zoro' ? 'marco-dorado marco-zoro' : 'marco-' + marco;
    return marco ? html`<span class="marco ${clases} ${clase || ''}">${dentro}${extra}</span>` : dentro;
  }
  function avatarSolo(nombre, clase) {
    const foto = (Datos.V.avatares || {})[nombre];
    if (foto) return html`<img class="avatar ${clase || ''}" src="${Datos.archivo(foto)}" alt="">`;
    const i = (Datos.V.grupo || []).indexOf(nombre);
    let h = 0;
    for (const c of String(nombre)) h = (h * 31 + c.codePointAt(0)) % 360;
    const color = i >= 0 ? COLORES[i % COLORES.length] : `hsl(${h} 55% 45%)`;
    return html`<span class="avatar ini ${clase || ''}" style="--c:${color}" aria-hidden="true">
      ${String(nombre).charAt(0).toUpperCase()}</span>`;
  }

  // Chip con el color de la zona.
  const zona = id => html`<span class="zona" style="--z:${Datos.zona(id).color}">${Datos.zona(id).nombre}</span>`;

  return { billetesDe, plan, cabeceraPlan, cambiarModo, mapa, billete, excursion, zona, chipBillete, chipLugar, alojamiento, guia, avatar };
})();
