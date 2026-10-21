// Billetes (#/billetes) y cada uno (#/billetes/<id>). Las imágenes (QR) se ven en grande sobre fondo blanco;
// los PDF se abren en otra pestaña o se descargan. Todo va dentro de la página cifrada, así que funciona sin conexión.
const Billetes = (() => {
  const { html, ICON } = U;
  const V = Datos.V;

  function render(root, id) {
    const b = id && Datos.billete(id);
    if (b) detalle(root, b);
    else lista(root);
  }

  function lista(root) {
    const ordenados = [...V.billetes].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    const pendientes = ordenados.filter(b => !Datos.archivosBillete(b).length).length;
    root.innerHTML = html`
      <h1 class="h">Billetes</h1>
      ${pendientes ? html`<p class="hint">${pendientes} pendientes de añadir.</p>` : ''}
      <div class="billetes">${ordenados.map(Piezas.billete)}</div>`;
  }

  function detalle(root, b) {
    const archivos = Datos.archivosBillete(b);
    const dia = Datos.dia(b.fecha);
    root.innerHTML = html`
      <a class="volver" href="#/billetes">${ICON.left}<span>Billetes</span></a>
      <h1 class="h">${b.titulo}</h1>
      <p class="sub-h">${U.fmtLong(b.fecha)}${b.hora ? ' · ' + b.hora : ''}
        ${dia ? html` · <a href="#/dia/${dia.fecha}">ver el día</a>` : ''}</p>
      ${b.nota ? html`<p>${U.rich(b.nota)}</p>` : ''}
      ${b.guia && Datos.guia(b.guia) ? html`<div class="guias-dia">${Piezas.guia(Datos.guia(b.guia), true)}</div>` : ''}
      ${archivos.length ? archivos.map(archivo) : html`<p class="vacio">Aún no está el billete.</p>`}`;
    U.onActions(root, {
      abrir: el => abrir(archivos[Number(el.dataset.i)]),
      ampliar: el => ampliar(archivos[Number(el.dataset.i)]),
    });
  }

  const esImagen = a => /\.(png|jpe?g|webp|gif)$/i.test(a.ruta);

  function archivo(a, i) {
    if (esImagen(a)) {
      return html`<figure class="billete-img" data-act="ampliar" data-i="${i}">
        <figcaption>${a.nombre}</figcaption><img src="${a.url}" alt="${a.nombre}" loading="lazy">
        <small>Toca para verlo en grande</small></figure>`;
    }
    return html`<div class="billete-pdf">
      <span>${ICON.ticket}<b>${a.nombre}</b></span>
      <span class="row">
        <button type="button" class="btn primary" data-act="abrir" data-i="${i}">${ICON.out}<span>Abrir</span></button>
        <a class="btn" href="${a.url}" download="${a.nombre}">${ICON.download}<span>Descargar</span></a>
      </span>
    </div>`;
  }

  // A pantalla completa sobre blanco, para enseñarlo en el torno. Se cierra tocando.
  function ampliar(a) {
    const dialog = document.createElement('dialog');
    dialog.className = 'billete-grande';
    dialog.innerHTML = html`<p>${a.nombre}</p><img src="${a.url}" alt="${a.nombre}"><small>Toca para cerrar · sube el brillo</small>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', () => dialog.close());
    dialog.showModal();
  }

  // Los data: URI no se pueden abrir en otra pestaña; un blob, sí.
  async function abrir(a) {
    try {
      const blob = await (await fetch(a.url)).blob();
      const url = URL.createObjectURL(blob);
      if (!window.open(url, '_blank')) location.href = url;
    } catch {
      U.toast('No se ha podido abrir; prueba con «Descargar».');
    }
  }

  return { nav: 'billetes', render };
})();
