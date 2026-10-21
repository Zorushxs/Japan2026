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
    const tiene = Datos.archivosBillete(b).length > 0;
    return html`<a class="chip-billete ${tiene ? '' : 'falta'}" href="#/billetes/${b.id}">
      ${ICON.ticket}<span>${b.titulo}</span>${tiene ? '' : html`<em>pendiente</em>`}</a>`;
  };

  // Un paso del plan. Los de tipo «tiempo» son una línea pequeña entre dos pasos.
  function paso(p, numeros) {
    const lugares = p.lugares || [];
    const extra = lugares.length || p.billete
      ? html`<div class="chips">${lugares.map(id => chipLugar(id, numeros))}${p.billete ? chipBillete(p.billete) : ''}</div>`
      : '';
    if (p.tipo === 'tiempo') return html`<li class="paso tiempo"><p>${rich(p.texto)}</p></li>`;
    return html`<li class="paso ${p.tipo ? 'nota nota-' + p.tipo : ''}">
      ${p.hora ? html`<span class="hora">${p.hora}</span>` : ''}
      <div class="cuerpo">
        ${p.tipo ? html`<span class="etiqueta">${ETIQUETAS[p.tipo] || p.tipo}</span>` : ''}
        <p>${rich(p.texto)}</p>
        ${p.sub ? html`<ul class="sub">${p.sub.map(s => html`<li>${rich(s)}</li>`)}</ul>` : ''}
        ${extra}
      </div>
    </li>`;
  }

  const plan = (pasos, numeros) => html`<ol class="plan">${pasos.map(p => paso(p, numeros))}</ol>`;

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
  function billete(b) {
    const tiene = Datos.archivosBillete(b).length > 0;
    return html`<a class="billete ${tiene ? '' : 'falta'}" href="#/billetes/${b.id}">
      <span class="billete-ico">${ICON.ticket}</span>
      <span class="billete-txt"><b>${b.titulo}</b>
        <small>${U.fmtShort(b.fecha)}${b.hora ? ' · ' + b.hora : ''}</small></span>
      <span class="billete-estado">${tiene ? 'Ver' : 'Pendiente'}</span>
    </a>`;
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

  // Chip con el color de la zona.
  const zona = id => html`<span class="zona" style="--z:${Datos.zona(id).color}">${Datos.zona(id).nombre}</span>`;

  return { plan, mapa, billete, excursion, zona, chipBillete, chipLugar, alojamiento, guia };
})();
