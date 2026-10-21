// Mapa del viaje (#/mapa): el mapa de Google My Maps incrustado (necesita conexión) y un botón para abrirlo en
// Google Maps (en el móvil, en la app).
const Mapa = (() => {
  const { html, ICON } = U;

  function render(root) {
    const mapa = Datos.mapaGoogle();
    if (!mapa) {
      root.innerHTML = html`<h1 class="h">Mapa del viaje</h1>
        <p class="vacio">Aún no hay mapa de Google. Va en <b>mapaGoogle</b> de los datos del viaje.</p>`;
      return;
    }
    root.innerHTML = html`
      <div class="mapa-cab">
        <h1 class="h">Mapa del viaje</h1>
        <a class="btn primary" href="${mapa.abrir}" target="_blank" rel="noopener">${ICON.out}<span>Abrir en Google Maps</span></a>
      </div>
      <iframe class="mapa-google" src="${mapa.embed}" title="Mapa del viaje en Google Maps"
        referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
      <p class="hint">Necesita conexión. Sin internet, usa los mapas de cada día.</p>`;
  }

  return { nav: 'mapa', render };
})();
