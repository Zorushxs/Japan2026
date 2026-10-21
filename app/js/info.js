// Notas generales del plan (#/info): cómo está planteado, qué se ha descartado y consejos.
const Info = (() => {
  const { html, rich } = U;

  function render(root) {
    const info = Datos.V.info;
    root.innerHTML = html`
      <a class="volver" href="#/">${U.ICON.left}<span>Calendario</span></a>
      <h1 class="h">Notas del plan</h1>
      ${(Datos.V.guias || []).length ? html`<h2 class="h2">Guías</h2>
        <div class="billetes">${Datos.V.guias.map(Piezas.guia)}</div>` : ''}
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
