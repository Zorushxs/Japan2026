// Billetes (#/billetes) y cada uno (#/billetes/<id>). Las imágenes (QR) se ven en grande sobre fondo blanco;
// los PDF se abren en otra pestaña o se descargan. Todo va dentro de la página cifrada, así que funciona sin conexión.
// Cada entrada puede tener el nombre de quien la usa y marcarse como usada; eso se comparte entre todos (Sincro).
const Billetes = (() => {
  const { html, ICON } = U;
  const V = Datos.V;
  const SOY = 'viaje:soy';
  let actual = null;

  function render(root, id) {
    const b = id && Datos.billete(id);
    actual = b || null;
    if (b) detalle(root, b);
    else lista(root);
    Sincro.onCambio(() => { if (App.pantalla() === Billetes && !document.querySelector('dialog[open]')) App.refresh(); });
  }

  function lista(root) {
    const ordenados = [...V.billetes].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    const pendientes = ordenados.filter(b => !Datos.archivosBillete(b).length).length;
    root.innerHTML = html`
      <h1 class="h">Billetes</h1>
      ${pendientes ? html`<p class="hint">${pendientes} pendientes de añadir.</p>` : ''}
      <div class="billetes">${ordenados.map(Piezas.billete)}</div>`;
  }

  // ---------- Quién soy (solo en este móvil) ----------
  function soy() {
    try { return localStorage.getItem(SOY) || ''; } catch { return ''; }
  }
  function ponerSoy(nombre) {
    try { localStorage.setItem(SOY, nombre); } catch {}
  }

  function detalle(root, b) {
    const yo = soy();
    // Primero el tuyo (si has dicho quién eres), luego el resto en su orden.
    const archivos = Datos.archivosBillete(b).map((a, i) => ({ ...a, i, estado: Sincro.item(Sincro.clave(b, a)) }));
    const ordenados = yo ? [...archivos].sort((x, y) => (y.estado.nombre === yo) - (x.estado.nombre === yo)) : archivos;
    const conNombre = archivos.filter(a => a.estado.nombre).length;
    const usados = archivos.filter(a => a.estado.usado).length;
    const dia = Datos.dia(b.fecha);
    root.innerHTML = html`
      <a class="volver" href="#/billetes">${ICON.left}<span>Billetes</span></a>
      <h1 class="h">${b.titulo}</h1>
      <p class="sub-h">${U.fmtLong(b.fecha)}${b.hora ? ' · ' + b.hora : ''}
        ${dia ? html` · <a href="#/dia/${dia.fecha}">ver el día</a>` : ''}</p>
      ${b.nota ? html`<p>${U.rich(b.nota)}</p>` : ''}
      ${b.guia && Datos.guia(b.guia) ? html`<div class="guias-dia">${Piezas.guia(Datos.guia(b.guia), true)}</div>` : ''}
      ${archivos.length > 1 ? html`
        <div class="reparto">
          <p><b>${conNombre} de ${archivos.length}</b> con nombre · <b>${usados}</b> usados</p>
          <div class="row">
            <span class="hint">Soy:</span>
            <button type="button" class="btn-ruta" data-act="soy">${yo || 'Elegir…'}</button>
          </div>
          <p class="hint sincro">${Sincro.texto()}</p>
        </div>` : ''}
      ${archivos.length ? ordenados.map(a => archivo(b, a, yo, archivos.length > 1))
        : html`<p class="vacio">Aún no está el billete.</p>`}`;
    const de = el => archivos[Number(el.dataset.i)];
    U.onActions(root, {
      abrir: el => abrir(de(el)),
      ampliar: el => ampliar(de(el)),
      nombre: el => preguntarNombre(b, de(el)),
      usado: el => {
        const a = de(el);
        Sincro.cambiar(Sincro.clave(b, a), { usado: !a.estado.usado });
      },
      soy: () => elegirSoy(),
    });
  }

  const esImagen = a => /\.(png|jpe?g|webp|gif)$/i.test(a.ruta);

  // Una entrada: de quién es, si está usada y la imagen (o el PDF).
  function archivo(b, a, yo, reparto) {
    const mio = yo && a.estado.nombre === yo;
    const controles = reparto ? html`<div class="billete-ctrl">
        <button type="button" class="btn-ruta ${a.estado.nombre ? 'con-nombre' : ''}" data-act="nombre" data-i="${a.i}">
          ${a.estado.nombre ? '👤 ' + a.estado.nombre : 'Asignar a…'}</button>
        <button type="button" class="btn-ruta usado" data-act="usado" data-i="${a.i}" aria-pressed="${a.estado.usado}">
          ${a.estado.usado ? '✓ Usado' : 'Sin usar'}</button>
      </div>` : '';
    if (esImagen(a)) {
      return html`<div class="billete-caja ${mio ? 'mio' : ''} ${a.estado.usado ? 'gastado' : ''}">
        ${mio ? html`<p class="tu-billete">Tu billete</p>` : ''}
        <p class="billete-nombre">${a.nombre}</p>
        ${controles}
        <figure class="billete-img" data-act="ampliar" data-i="${a.i}">
          <img src="${a.url}" alt="${a.nombre}" loading="lazy"><small>Toca para verlo en grande</small></figure>
      </div>`;
    }
    return html`<div class="billete-pdf">
      <span>${ICON.ticket}<b>${a.nombre}</b></span>
      ${controles}
      <span class="row">
        <button type="button" class="btn primary" data-act="abrir" data-i="${a.i}">${ICON.out}<span>Abrir</span></button>
        <a class="btn" href="${a.url}" download="${a.nombre}">${ICON.download}<span>Descargar</span></a>
      </span>
    </div>`;
  }

  // ---------- Ventanas ----------
  // Ventana con un campo de texto y los nombres ya usados como atajos. Devuelve el texto, '' (quitar) o null.
  function pedirNombre(titulo, inicial, conQuitar) {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    const atajos = Sincro.nombres();
    dialog.innerHTML = html`<form method="dialog">
      <h2>${titulo}</h2>
      <input name="nombre" value="${inicial}" placeholder="Nombre" autocomplete="off" autocapitalize="words" maxlength="40">
      ${atajos.length ? html`<div class="chips">${atajos.map(n =>
        html`<button type="button" class="btn-ruta" data-nombre="${n}">${n}</button>`)}</div>` : ''}
      <div class="ask-btns">
        ${conQuitar && inicial ? html`<button value="quitar" class="btn">Quitar</button>` : ''}
        <button value="no" class="btn">Cancelar</button>
        <button value="si" class="btn primary">Guardar</button>
      </div>
    </form>`;
    document.body.append(dialog);
    const campo = dialog.querySelector('input');
    dialog.querySelectorAll('[data-nombre]').forEach(el => {
      el.onclick = () => { campo.value = el.dataset.nombre; campo.focus(); };
    });
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        const v = dialog.returnValue;
        resolve(v === 'si' ? campo.value.trim() : v === 'quitar' ? '' : null);
        dialog.remove();
      });
      dialog.showModal();
      campo.focus();
    });
  }

  async function preguntarNombre(b, a) {
    const nombre = await pedirNombre(`¿De quién es ${a.nombre.replace(/\s*\(.*\)$/, '')}?`, a.estado.nombre, true);
    if (nombre === null) return;
    Sincro.cambiar(Sincro.clave(b, a), { nombre });
  }

  async function elegirSoy() {
    const nombre = await pedirNombre('¿Quién eres? (solo en este móvil)', soy(), true);
    if (nombre === null) return;
    ponerSoy(nombre);
    App.refresh();
  }

  // A pantalla completa sobre blanco, para enseñarlo en el torno. Se cierra tocando.
  function ampliar(a) {
    const dialog = document.createElement('dialog');
    dialog.className = 'billete-grande';
    const quien = a.estado && a.estado.nombre ? ' · ' + a.estado.nombre : '';
    dialog.innerHTML = html`<p>${a.nombre}${quien}</p><img src="${a.url}" alt="${a.nombre}">
      <small>Toca para cerrar · sube el brillo</small>`;
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

  return { nav: 'billetes', render, actual: () => actual };
})();
