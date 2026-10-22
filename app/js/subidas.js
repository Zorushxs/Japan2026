// Huecos para subir el comprobante de una reserva (consigna, envío de maletas…) desde el móvil: foto, captura o PDF.
// Se ven en las guías, días y billetes que llevan `subidas: { id, titulo }`. Se comparten con todo el grupo (cifrados,
// en la misma base de datos que los billetes). En la versión de invitado no salen.
const Subidas = (() => {
  const { html, ICON } = U;
  const MAX_PDF = 3 * 1024 * 1024;

  // El hueco vacío (se rellena con montar()).
  function seccion(sub) {
    if (!sub || Datos.V.invitado) return '';
    return html`<section class="subidas" data-hueco="${sub.id}">
      <div class="subidas-cab">
        <h2 class="h2">${sub.titulo || 'Comprobantes'}</h2>
        <label class="btn primary subir">${ICON.download}<span>Subir</span>
          <input type="file" accept="image/*,application/pdf" hidden></label>
      </div>
      <p class="hint subidas-estado">Cargando…</p>
      <div class="subidas-lista"></div>
    </section>`;
  }

  // Busca los huecos de la pantalla, carga lo subido y conecta los botones.
  function montar(root) {
    root.querySelectorAll('.subidas[data-hueco]').forEach(el => {
      const hueco = el.dataset.hueco;
      const pintar = lista => pintarLista(el, hueco, lista);
      pintar(Sincro.subidasGuardadas(hueco));
      cargar(el, hueco, pintar);
      el.querySelector('input[type=file]').onchange = async ev => {
        const file = ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        estado(el, 'Subiendo…');
        try {
          const datos = await leer(file);
          await Sincro.subir(hueco, { nombre: file.name || 'Comprobante', tipo: datos.tipo, datos: datos.url,
            quien: Billetes.soy() || '' });
          U.toast('Subido. Ya lo ve todo el grupo.');
          cargar(el, hueco, pintar);
        } catch (e) {
          estado(el, e.message === 'sin base de datos' ? 'Solo se puede subir en la versión con contraseña.'
            : e.message === 'grande' ? 'El PDF es demasiado grande (máx. 3 MB). Haz una captura y súbela.'
            : 'No se ha podido subir: ' + (navigator.onLine ? e.message : 'sin conexión') + '.');
        }
      };
    });
  }

  function estado(el, texto) {
    el.querySelector('.subidas-estado').textContent = texto;
  }

  async function cargar(el, hueco, pintar) {
    if (!Sincro.activo()) {
      estado(el, 'Se comparte en la versión con contraseña (aquí no hay base de datos).');
      return;
    }
    try {
      pintar(await Sincro.listarSubidas(hueco));
    } catch {
      estado(el, 'Sin conexión: se ve lo último que se cargó en este móvil.');
    }
  }

  function pintarLista(el, hueco, lista) {
    estado(el, lista.length ? `${lista.length} ${lista.length === 1 ? 'archivo' : 'archivos'} · se comparte con el grupo`
      : 'Aún no hay nada. Cuando lo reservéis, subid aquí la captura o el PDF de la reserva.');
    const caja = el.querySelector('.subidas-lista');
    caja.innerHTML = html`${lista.map((a, i) => html`<div class="subida">
      ${a.tipo === 'pdf'
        ? html`<button type="button" class="subida-pdf" data-i="${i}" data-sub="ver">${ICON.ticket}<span>PDF</span></button>`
        : html`<img src="${a.datos}" alt="${a.nombre}" data-i="${i}" data-sub="ver">`}
      <div class="subida-txt"><b>${a.nombre}</b>
        <small>${a.quien ? 'Lo subió ' + a.quien + ' · ' : ''}${new Date(a.t).toLocaleDateString('es')}</small></div>
      <button type="button" class="icon-btn" data-i="${i}" data-sub="borrar" aria-label="Borrar">${ICON.close}</button>
    </div>`)}`;
    caja.onclick = async ev => {
      const b = ev.target.closest('[data-sub]');
      if (!b) return;
      const a = lista[Number(b.dataset.i)];
      if (b.dataset.sub === 'ver') ver(a);
      if (b.dataset.sub === 'borrar' && confirm(`¿Borrar «${a.nombre}» para todo el grupo?`)) {
        try {
          await Sincro.borrarSubida(hueco, a.id);
          cargar(el, hueco, l => pintarLista(el, hueco, l));
        } catch {
          U.toast('No se ha podido borrar (¿sin conexión?).');
        }
      }
    };
  }

  // Imagen a pantalla completa; PDF en otra pestaña.
  async function ver(a) {
    if (a.tipo === 'pdf') {
      const blob = await (await fetch(a.datos)).blob();
      const url = URL.createObjectURL(blob);
      if (!window.open(url, '_blank')) location.href = url;
      return;
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'billete-grande';
    dialog.innerHTML = html`<p>${a.nombre}</p><img src="${a.datos}" alt="${a.nombre}"><small>Toca para cerrar</small>`;
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', () => dialog.close());
    U.modal(dialog);
  }

  // Foto o captura: reducida a 1600 px y en JPEG (pocos cientos de KB). PDF: tal cual, hasta 3 MB.
  async function leer(file) {
    if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF) throw new Error('grande');
      return { tipo: 'pdf', url: await dataUrl(file) };
    }
    const img = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return { tipo: 'imagen', url: canvas.toDataURL('image/jpeg', 0.82) };
  }
  const dataUrl = file => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = ko;
    r.readAsDataURL(file);
  });

  return { seccion, montar };
})();
