// Alojamientos (#/alojamientos): dónde dormimos cada noche, en orden, con fechas, dirección y botones de Google Maps.
// Durante el viaje, el de esta noche sale marcado.
const Alojamientos = (() => {
  const { html } = U;

  function render(root) {
    const hoy = U.today();
    const esta = Datos.estancias().find(e => hoy >= e.desde && hoy < e.hasta);
    root.innerHTML = html`
      <h1 class="h">Alojamientos</h1>
      <p class="hint">Del check-in al check-out. Toca «Cómo llegar» para ir desde donde estés.</p>
      <div class="alojamientos">${Datos.estancias().map(e => {
        const noches = U.daysBetween(e.desde, e.hasta);
        const etiqueta = `${e === esta ? 'Esta noche · ' : ''}${U.fmtShort(e.desde)} → ${U.fmtShort(e.hasta)} · `
          + `${noches} ${noches === 1 ? 'noche' : 'noches'}`;
        return html`<div class="${e === esta ? 'aloj-actual' : ''}">${Piezas.alojamiento(e.clave, etiqueta, 'transit')}</div>`;
      })}</div>`;
  }

  return { nav: 'alojamientos', render };
})();
