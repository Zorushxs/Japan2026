// Recordatorios con fecha (VIAJE.avisos): una ventana al abrir la app mientras hoy esté entre `desde` y `hasta`.
// «Ya está hecho» lo quita para todo el grupo (se comparte con Sincro); «Recuérdamelo mañana», solo en este móvil y
// hasta mañana.
const Avisos = (() => {
  const { html, rich } = U;
  const POSPUESTO = 'viaje:aviso:';
  const clave = a => `aviso|${a.id}`;

  function pendientes() {
    const hoy = U.today();
    return (Datos.V.avisos || []).filter(a => hoy >= a.desde && hoy <= a.hasta
      && Sincro.item(clave(a)).valor !== 'hecho' && pospuesto(a) !== hoy);
  }
  function pospuesto(a) {
    try { return localStorage.getItem(POSPUESTO + a.id); } catch { return null; }
  }

  // Enseña el primero pendiente (si hay otro, sale la próxima vez).
  function mostrar() {
    const a = pendientes()[0];
    if (!a || document.querySelector('dialog[open]')) return false;
    const guia = a.guia && Datos.guia(a.guia);
    const dialog = document.createElement('dialog');
    dialog.className = 'ask aviso-modal';
    dialog.innerHTML = html`<form method="dialog">
      <p class="aviso-modal-ico" aria-hidden="true">⏰</p>
      <h2>${a.titulo}</h2>
      <p>${rich(a.texto)}</p>
      ${guia ? html`<a class="btn-ruta" href="#/guia/${guia.id}" data-cerrar="">${guia.emoji} Ver la guía</a>` : ''}
      <div class="ask-btns">
        <button value="luego" class="btn">Recuérdamelo mañana</button>
        <button value="hecho" class="btn primary">Ya está hecho</button>
      </div>
    </form>`;
    dialog.querySelector('[data-cerrar]')?.addEventListener('click', () => {
      dialog.dataset.sinAtras = '1';
      dialog.close('luego');
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'hecho') {
        Sincro.cambiar(clave(a), { valor: 'hecho' });
        U.toast('Hecho: ya no saldrá a nadie.');
      } else {
        try { localStorage.setItem(POSPUESTO + a.id, U.today()); } catch {}
      }
    });
    U.modal(dialog);
    return true;
  }

  return { mostrar };
})();
