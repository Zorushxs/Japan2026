// Easter egg: los viernes de emisión de STEEL BALL RUN (JoJo, Netflix) sale un aviso con la hora del capítulo en la
// zona horaria del móvil. Netflix lo estrena los viernes a las 17:00 de Japón (8:00 UTC). Una vez por viernes y móvil.
const Jojo = (() => {
  const { html } = U;
  const PRIMERO = '2026-09-25'; // 2nd STAGE: un capítulo por semana
  const ULTIMO = '2026-12-04';  // 11 capítulos
  const HORA_UTC = 8;           // 17:00 en Japón
  const VISTO = 'viaje:jojo';

  function hoyToca() {
    const hoy = U.today();
    return new Date().getDay() === 5 && hoy >= PRIMERO && hoy <= ULTIMO;
  }

  function avisar(forzar) {
    const hoy = U.today();
    if (!forzar) {
      if (!hoyToca()) return;
      try { if (localStorage.getItem(VISTO) === hoy) return; localStorage.setItem(VISTO, hoy); } catch {}
    }
    const [y, m, d] = hoy.split('-').map(Number);
    const estreno = new Date(Date.UTC(y, m - 1, d, HORA_UTC));
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const hora = estreno.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const ya = Date.now() >= estreno.getTime();
    const capitulo = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 8, 25)) / (7 * 864e5)) + 1;
    const dialog = document.createElement('dialog');
    dialog.className = 'jojo';
    dialog.innerHTML = html`
      <div class="jojo-gogo" aria-hidden="true"><span>ゴ</span><span>ゴ</span><span>ゴ</span><span>ゴ</span></div>
      <p class="jojo-pre">Es viernes de JoJo</p>
      <h2>STEEL BALL RUN</h2>
      <p class="jojo-sub">JoJo’s Bizarre Adventure · 2nd STAGE · Netflix</p>
      ${ya
        ? html`<p class="jojo-hora">¡Ya está disponible!<small>Capítulo ${capitulo} de la 2.ª etapa · salió a las ${hora}</small></p>`
        : html`<p class="jojo-hora">Hoy a las <b>${hora}</b><small>Capítulo ${capitulo} de la 2.ª etapa · hora de aquí (${zona})</small></p>`}
      <button type="button" class="jojo-btn">To Be Continued ⟶</button>`;
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', () => dialog.close());
    U.modal(dialog);
  }

  return { avisar };
})();
