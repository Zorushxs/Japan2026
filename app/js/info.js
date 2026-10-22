// Notas generales del plan (#/info): cómo está planteado, qué se ha descartado y consejos.
const Info = (() => {
  const { html, rich } = U;

  function render(root) {
    const info = Datos.V.info;
    // Las guías de los alojamientos, por orden de estancia; luego el resto, en el orden de los datos.
    const alojamientos = Datos.estancias().map(e => ({ e, g: Datos.guia(Datos.alojamiento(e.clave).guia) }))
      .filter(({ g }, i, todas) => g && todas.findIndex(x => x.g === g) === i);
    const otras = (Datos.V.guias || []).filter(g => !alojamientos.some(a => a.g === g));
    root.innerHTML = html`
      <a class="volver" href="#/">${U.ICON.left}<span>Calendario</span></a>
      <h1 class="h">Notas del plan</h1>

      ${alojamientos.length ? html`<h2 class="h2">Guías de los alojamientos</h2>
        <p class="hint">En el orden en que los ocupamos.</p>
        <div class="billetes">${alojamientos.map(({ e, g }) => html`<div class="guia-aloj">
          <small>${U.fmtShort(e.desde)} → ${U.fmtShort(e.hasta)} · ${Datos.alojamiento(e.clave).nombre}</small>
          ${Piezas.guia(g)}</div>`)}</div>` : ''}
      ${otras.length ? html`<h2 class="h2">Otras guías</h2>
        <div class="billetes">${otras.map(g => Piezas.guia(g))}</div>` : ''}
      <h2 class="h2">El plan</h2>
      ${info.intro.map(p => html`<p>${rich(p)}</p>`)}
      <h2 class="h2">Descartado</h2>
      <p>${rich(info.descartados)}</p>
      <h2 class="h2">Consejos</h2>
      <ul class="consejos">${info.consejos.map(c => html`<li>${rich(c)}</li>`)}</ul>
      <h2 class="h2">Leyenda de las notas</h2>
      <ol class="plan">
        ${['info', 'tiempo', 'aviso', 'importante', 'opcional', 'alternativa'].map(tipo => html`
          <li class="paso nota nota-${tipo}"><div class="cuerpo"><span class="etiqueta">${LEYENDA[tipo][0]}</span>
            <p>${LEYENDA[tipo][1]}</p></div></li>`)}
      </ol>`;
  }

  const LEYENDA = {
    info: ['Info', 'Información.'],
    tiempo: ['Tiempo', 'Trayectos y duraciones.'],
    aviso: ['Ojo', 'Advertencias.'],
    importante: ['Importante', 'Lo que no hay que olvidar.'],
    opcional: ['Opcional', 'Si da tiempo o apetece.'],
    alternativa: ['Alternativa', 'Plan para los que no vayan.'],
  };

  return { nav: 'calendario', render };
})();
