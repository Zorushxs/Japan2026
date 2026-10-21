// Excursiones (#/excursiones) y el plan de cada una (#/excursion/<id>).
const Excursiones = (() => {
  const { html, rich } = U;
  const V = Datos.V;

  function render(root, id) {
    const e = id && Datos.excursion(id);
    if (e) detalle(root, e);
    else lista(root);
  }

  function lista(root) {
    const grupo = (titulo, desde, nota) => html`<section class="bloque">
      <h2 class="h2">${titulo}</h2>
      ${nota ? html`<p class="hint">${nota}</p>` : ''}
      <div class="excs">${V.excursiones.filter(e => e.desde === desde).map(Piezas.excursion)}</div>
    </section>`;
    root.innerHTML = html`
      <h1 class="h">Excursiones</h1>
      ${grupo('Desde Tokio · 9–13 nov', 'Tokio', 'Días de excursiones cruzadas: el grupo se divide y cada uno elige.')}
      ${grupo('Desde Osaka', 'Osaka')}`;
  }

  function detalle(root, e) {
    const mapas = Datos.mapasExcursion(e);
    const dias = Datos.diasDe(e.id);
    root.innerHTML = html`
      <div class="dia" style="--z:${Datos.zona(e.zona).color}">
        <a class="volver" href="#/excursiones">${U.ICON.left}<span>Excursiones</span></a>
        <h1 class="h">${e.emoji} ${e.titulo}</h1>
        <div class="row">
          ${Piezas.zona(e.zona)}
          ${e.letra ? html`<span class="tag">Opción ${e.letra}</span>` : ''}
          ${e.prioridad ? html`<span class="tag">Prioridad ${e.prioridad}</span>` : ''}
        </div>
        <p class="resumen">${rich(e.resumen)}</p>
        ${dias.length ? html`<p class="hint">Desde ${e.desde}, ${dias.length > 1 ? 'para uno de estos días' : 'el'}:
          ${dias.map((d, i) => html`${i ? ', ' : ''}<a href="#/dia/${d.fecha}">${U.fmtShort(d.fecha)}</a>`)}</p>` : ''}
        ${mapas.map(m => Piezas.mapa(m, null))}
        ${Piezas.cabeceraPlan()}
        ${Piezas.plan(e.plan, Datos.numeros(mapas))}
      </div>`;
  }

  return { nav: 'excursiones', render };
})();
