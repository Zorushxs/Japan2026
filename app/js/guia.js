// Guías (#/guia/<id>): textos de ayuda del viaje (p. ej. el envío de maletas). Los mensajes en japonés se pueden
// enseñar a pantalla completa en un mostrador o copiar.
const Guia = (() => {
  const { html, rich, ICON } = U;
  let actual = null;

  function render(root, id) {
    const g = Datos.guia(id);
    if (!g) {
      root.innerHTML = html`<p class="vacio">No existe esta guía.</p>`;
      return;
    }
    actual = g;
    const dias = Datos.dias.filter(d => (d.guias || []).includes(g.id));
    root.innerHTML = html`
      <a class="volver" href="#/info">${ICON.left}<span>Notas del plan</span></a>
      <h1 class="h">${g.emoji} ${g.titulo}</h1>
      ${g.resumen ? html`<p class="resumen">${rich(g.resumen)}</p>` : ''}
      ${dias.length ? html`<p class="hint">Días: ${dias.map((d, i) =>
        html`${i ? ', ' : ''}<a href="#/dia/${d.fecha}">${U.fmtShort(d.fecha)}</a>`)}</p>` : ''}
      <div class="guia">${g.bloques.map(bloque)}</div>`;
    U.onActions(root, {
      grande: el => grande(el.dataset.i),
      copiar: el => copiar(el.dataset.i),
    });
  }

  function bloque(b, i) {
    if (b.h) return html`<h2 class="h2">${b.h}</h2>`;
    if (b.p) return html`<p>${rich(b.p)}</p>`;
    if (b.aviso) return html`<div class="nota nota-aviso guia-nota"><div class="cuerpo"><span class="etiqueta">Ojo</span>
      <p>${rich(b.aviso)}</p></div></div>`;
    if (b.jp) return japones(b, i);
    if (b.lista) return html`<ul class="guia-lista">${b.lista.map(item => html`<li>${rich(item)}</li>`)}</ul>`;
    if (b.tabla) {
      const [cabecera, ...filas] = b.tabla;
      return html`<table class="guia-tabla"><thead><tr>${cabecera.map(c => html`<th>${c}</th>`)}</tr></thead>
        <tbody>${filas.map(f => html`<tr>${f.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody></table>`;
    }
    if (b.lugares) return html`<div class="chips">${b.lugares.map(id => Piezas.chipLugar(id, {}))}</div>`;
    if (b.enlaces) return html`<ul class="guia-lista">${b.enlaces.map(e =>
      html`<li><a href="${e.url}" target="_blank" rel="noopener">${e.texto}</a></li>`)}</ul>`;
    return '';
  }

  // Mensaje en japonés, con la traducción plegada y botones para enseñarlo en grande o copiarlo.
  const japones = (b, i) => html`<div class="jp-card">
    <p class="jp-texto" lang="ja">${b.jp}</p>
    ${b.es ? html`<details class="jp-es"><summary>Traducción</summary><p>${b.es}</p></details>` : ''}
    <div class="row">
      <button type="button" class="btn primary" data-act="grande" data-i="${i}">Enseñar en grande</button>
      <button type="button" class="btn" data-act="copiar" data-i="${i}">Copiar</button>
    </div>
  </div>`;

  // A pantalla completa, letra grande y fondo blanco. Se cierra tocando.
  function grande(i) {
    const dialog = document.createElement('dialog');
    dialog.className = 'jp-grande';
    dialog.innerHTML = html`<p lang="ja">${actual.bloques[i].jp}</p><small>Toca para cerrar</small>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', () => dialog.close());
    dialog.showModal();
  }

  async function copiar(i) {
    try {
      await navigator.clipboard.writeText(actual.bloques[i].jp);
      U.toast('Copiado.');
    } catch {
      U.toast('No se ha podido copiar.');
    }
  }

  return { nav: null, render };
})();
