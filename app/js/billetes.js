// Billetes (#/billetes) y cada uno (#/billetes/<id>). Las imágenes (QR) se ven en grande sobre fondo blanco;
// los PDF se abren en otra pestaña o se descargan. Todo va dentro de la página cifrada, así que funciona sin conexión.
// Cada entrada puede tener el nombre de quien la usa y marcarse como usada; eso se comparte entre todos (Sincro).
const Billetes = (() => {
  const { html, ICON } = U;
  const V = Datos.V;
  const SOY = 'viaje:soy';
  let actual = null;
  let yaPreguntado = false; // la ventana de «¿Quién eres?» se abre sola una vez por visita
  let otrosAbierto = false;  // el desplegable con los billetes del resto (se mantiene al repintar)

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
      ${Billetes.soy() ? '' : html`<p class="hint">Di quién eres (en el calendario) para ver primero los tuyos.</p>`}
      ${Piezas.billetesDe(ordenados)}`;
  }

  // ---------- Quién soy (solo en este móvil) ----------
  function soy() {
    try { return localStorage.getItem(SOY) || ''; } catch { return ''; }
  }
  function ponerSoy(nombre) {
    try { localStorage.setItem(SOY, nombre); } catch {}
  }

  // Textos de un billete repartido: por defecto «asiento» y «Usado»; un billete puede cambiarlos (p. ej. un pase:
  // cosa: 'pase', marca: ['Sin canjear', 'Canjeado', 'canjeados']). Y para quién es (para: […]; si no, todo el grupo).
  function textos(b) {
    const [sinUsar, usado, usados] = b.marca || ['Sin usar', 'Usado', 'usados'];
    return { cosa: b.cosa || 'asiento', sinUsar, usado, usados, para: b.para || V.grupo || [] };
  }

  function detalle(root, b) {
    const T = textos(b);
    const yo = soy();
    // Primero el tuyo (si has dicho quién eres), luego el resto en su orden.
    const archivos = Datos.archivosBillete(b).map((a, i) => ({ ...a, i, estado: Sincro.item(Sincro.clave(b, a)) }));
    const ordenados = yo ? [...archivos].sort((x, y) => (y.estado.nombre === yo) - (x.estado.nombre === yo)) : archivos;
    const conNombre = archivos.filter(a => a.estado.nombre).length;
    const usados = archivos.filter(a => a.estado.usado).length;
    const grupo = T.para;
    const asignados = new Set(archivos.map(a => a.estado.nombre).filter(Boolean));
    const todos = archivos.length >= grupo.length && grupo.length > 0 && grupo.every(n => asignados.has(n));
    const dia = Datos.dia(b.fecha);
    const reparto = Datos.reparte(b);
    const mio = yo && archivos.find(a => a.estado.nombre === yo);
    root.innerHTML = html`
      <a class="volver" href="#/billetes">${ICON.left}<span>Billetes</span></a>
      ${todos ? html`<p class="todos-asignados">✓ ¡Ya tenemos todos un ${T.cosa} asignado!</p>` : ''}
      ${reparto ? cajaYo(yo, mio, T) : ''}
      ${!reparto && b.para && yo && !b.para.includes(yo) ? html`<p class="no-es-tuyo">No es tu billete: es de
        ${b.para.map(n => html`<span class="nt-p">${Piezas.avatar(n, 'mini')}${n}</span>`)}</p>` : ''}
      <h1 class="h">${b.titulo}</h1>
      <p class="sub-h">${U.fmtLong(b.fecha)}${b.hora ? ' · ' + b.hora : ''}
        ${dia ? html` · <a href="#/dia/${dia.fecha}">ver el día</a>` : ''}</p>
      ${b.nota ? html`<p class="billete-nota">${U.rich(b.nota)}</p>` : ''}
      ${b.tramos ? vuelos(b) : ''}
      ${b.guia && Datos.guia(b.guia) ? html`<div class="guias-dia">${Piezas.guia(Datos.guia(b.guia), true)}</div>` : ''}
      ${b.drive ? html`<a class="btn drive" href="${b.drive}" target="_blank" rel="noopener">${ICON.out}
        <span>Este billete en Drive <small>(copia de los originales, por si acaso)</small></span></a>` : ''}
      ${reparto ? html`
        <div class="reparto">
          <p><b>${conNombre} de ${archivos.length}</b> con nombre · <b>${usados}</b> ${T.usados}</p>
          <p class="hint sincro">${Sincro.texto()}</p>
        </div>` : ''}
      ${!archivos.length ? html`<p class="vacio">Aún no está el billete.</p>`
        : mio && reparto ? html`${archivo(b, mio, yo, true, T)}
          <details class="otros" ${otrosAbierto ? 'open' : ''}>
            <summary>Billetes del resto (${archivos.length - 1})</summary>
            ${archivos.filter(a => a !== mio).map(a => archivo(b, a, yo, true, T))}
          </details>`
        : ordenados.map(a => archivo(b, a, yo, reparto, T))}`;
    const otros = root.querySelector('details.otros');
    if (otros) otros.addEventListener('toggle', () => { otrosAbierto = otros.open; });
    const de = el => archivos[Number(el.dataset.i)];
    U.onActions(root, {
      abrir: el => abrir(de(el)),
      ampliar: el => ampliar(de(el)),
      nombre: el => preguntarNombre(b, de(el), archivos, T),
      usado: el => {
        const a = de(el);
        Sincro.cambiar(Sincro.clave(b, a), { usado: !a.estado.usado });
      },
      soy: () => elegirSoy(),
      copiar: el => copiarTexto(el.dataset.texto),
    });
    // Si en este móvil aún no se ha dicho quién eres, se pregunta nada más entrar.
    if (reparto && !yo && !yaPreguntado) {
      yaPreguntado = true;
      setTimeout(elegirSoy, 350);
    }
  }

  // Recuadro grande de arriba: quién eres y tu asiento (o que aún no has elegido quién eres).
  function cajaYo(yo, mio, T) {
    if (!yo) {
      return html`<div class="yo sin-yo">
        <p class="yo-quien">👋 ¿Quién eres?</p>
        <p>Elige tu nombre para ver <b>tu</b> billete el primero y no coger el de otro.</p>
        <button type="button" class="btn yo-btn" data-act="soy">Elegir mi nombre</button>
      </div>`;
    }
    const noEsTuyo = !T.para.includes(yo);
    return html`<div class="yo ${mio ? '' : noEsTuyo ? 'no-tuyo' : 'sin-asiento'}">
      ${Piezas.avatar(yo, 'grande')}
      <p class="yo-quien">Eres <b>${yo}</b></p>
      ${mio ? html`<p class="yo-asiento">Tu ${T.cosa}: <b>${asiento(mio)}</b></p>
          <button type="button" class="btn yo-btn" data-act="ampliar" data-i="${mio.i}">Ver mi billete</button>`
        : noEsTuyo ? html`<p class="yo-asiento">Este billete no es para ti.</p>`
        : html`<p class="yo-asiento">Aún no tienes ${T.cosa} asignado.</p>`}
      <button type="button" class="yo-cambiar" data-act="soy">No soy ${yo}</button>
    </div>`;
  }

  // ---------- Vuelos ----------
  // Tramos como tarjetas de embarque (códigos de aeropuerto, horas, terminales, avisos y asientos con avatar), la escala
  // entre medias y la reserva con el localizador grande y los números de billete.
  const SIGNOS = '·';
  function punto(p, lado) {
    return html`<div class="tr-punto ${lado}">
      <b class="tr-iata">${p.iata}</b>
      <span class="tr-hora">${p.hora || '—'}</span>
      <small>${p.ciudad}${p.terminal ? ' ' + SIGNOS + ' ' + p.terminal : ''}</small>
      <small class="tr-fecha">${U.fmtShort(p.fecha)}</small>
    </div>`;
  }
  function tramo(t, n) {
    const asientos = Object.entries(t.asientos || {});
    return html`<div class="tramo">
      <div class="tr-cab">
        <span class="tr-num">${n}</span>
        <b>${t.aerolinea}</b>
        <span class="tr-vuelo">${t.vuelo}</span>
        ${t.tambien ? html`<small>también ${t.tambien}</small>` : ''}
      </div>
      <div class="tr-ruta">${punto(t.de, 'de')}<div class="tr-linea" aria-hidden="true"><span>✈</span></div>${punto(t.a, 'a')}</div>
      ${t.avion || t.clase || t.duracion ? html`<p class="tr-extra">${[t.duracion && '⏱ ' + t.duracion, t.avion, t.clase]
        .filter(Boolean).join(' · ')}</p>` : ''}
      ${t.aviso ? html`<p class="tr-aviso">⚠️ ${U.rich(t.aviso)}</p>` : ''}
      ${asientos.length ? html`<div class="tr-asientos">${asientos.map(([nombre, asiento]) => html`
        <span class="tr-asiento">${Piezas.avatar(nombre, 'mini')}<span>${nombre}</span><b>${asiento}</b></span>`)}</div>` : ''}
    </div>
    ${t.escala ? html`<div class="tr-escala">${U.rich(t.escala)}</div>` : ''}`;
  }
  function vuelos(b) {
    const r = b.reserva || {};
    const pax = Object.entries(b.pasajeros || {});
    return html`<div class="vuelos">
      ${b.tramos.map((t, i) => tramo(t, i + 1))}
      ${r.localizador ? html`<div class="reserva-vuelo">
        <div class="rv-loc"><small>Localizador</small><b>${r.localizador}</b>
          <button type="button" class="btn-ruta" data-act="copiar" data-texto="${r.localizador}">Copiar</button></div>
        ${r.trip ? html`<p class="hint">Trip.com nº ${r.trip}</p>` : ''}
        ${pax.length ? html`<div class="rv-pax">${pax.map(([nombre, billete]) => html`
          <span class="rv-p">${Piezas.avatar(nombre, 'mini')}<span>${nombre}</span><code>${billete}</code></span>`)}</div>` : ''}
        <p class="hint">Para facturar en la web de la aerolínea: localizador y apellido.</p>
      </div>` : ''}
    </div>`;
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      U.toast('Copiado: ' + texto);
    } catch {
      U.toast('No se ha podido copiar.');
    }
  }

  const esImagen = a => /\.(png|jpe?g|webp|gif)$/i.test(a.ruta);

  // Una entrada: de quién es, si está usada y la imagen (o el PDF).
  function archivo(b, a, yo, reparto, T) {
    const mio = yo && a.estado.nombre === yo;
    const controles = reparto ? html`<div class="billete-ctrl">
        <button type="button" class="btn-ruta ${a.estado.nombre ? 'con-nombre' : ''}" data-act="nombre" data-i="${a.i}">
          ${a.estado.nombre ? html`${Piezas.avatar(a.estado.nombre, 'mini')}<span>${a.estado.nombre}</span>` : 'Asignar a…'}</button>
        <button type="button" class="btn-ruta usado" data-act="usado" data-i="${a.i}" aria-pressed="${a.estado.usado}">
          ${a.estado.usado ? '✓ ' + T.usado : T.sinUsar}</button>
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
  // Asiento corto de una entrada: «Coche 12 · Asiento 15-A (reserva 2158)» → «15-A».
  const asiento = a => (/Asiento\s+(\S+)/.exec(a.nombre) || [])[1] || a.nombre.replace(/\s*\(.*\)$/, '');

  // Ventana con un botón por persona del grupo. `ocupados`: { nombre: 'en 16-B' } (salen marcados). Devuelve el nombre
  // elegido, '' (quitar) o null (cancelar).
  function elegirPersona(titulo, actualNombre, ocupados, personas, cosa) {
    const grupo = personas || V.grupo || [];
    if (!grupo.length) return pedirNombre(titulo, actualNombre, true);
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = html`<form method="dialog">
      <h2>${titulo}</h2>
      <div class="personas">${grupo.map(n => html`<button type="button" class="persona ${ocupados[n] ? 'ocupada' : ''}"
          data-persona="${n}" aria-pressed="${n === actualNombre}">
          ${Piezas.avatar(n)}<b>${n}</b>${ocupados[n] ? html`<small>${ocupados[n]}</small>` : ''}</button>`)}</div>
      ${Object.keys(ocupados).length ? html`<p class="hint">Si eliges a alguien que ya tiene ${cosa || 'asiento'}, se le cambia a este.</p>` : ''}
      <div class="ask-btns">
        ${actualNombre ? html`<button value="quitar" class="btn">Quitar</button>` : ''}
        <button value="no" class="btn">Cancelar</button>
      </div>
    </form>`;
    let elegido = null;
    dialog.querySelectorAll('[data-persona]').forEach(el => {
      el.onclick = () => { elegido = el.dataset.persona; dialog.close('elegido'); };
    });
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        const v = dialog.returnValue;
        resolve(v === 'elegido' ? elegido : v === 'quitar' ? '' : null);
        dialog.remove();
      });
      U.modal(dialog);
      // El foco en «Cancelar»: si no, el primer nombre parece elegido.
      dialog.querySelector('[value="no"]').focus();
    });
  }

  // Ventana con un campo de texto (si no hay grupo). Devuelve el texto, '' (quitar) o null.
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
      U.modal(dialog);
      campo.focus();
    });
  }

  // Asigna una entrada a alguien. Si esa persona ya tenía otra entrada de este billete, se le quita de allí.
  async function preguntarNombre(b, a, archivos, T) {
    const ocupados = {};
    archivos.forEach(otro => {
      if (otro !== a && otro.estado.nombre) ocupados[otro.estado.nombre] = 'en ' + asiento(otro);
    });
    const titulo = T.cosa === 'asiento' ? `¿De quién es el asiento ${asiento(a)}?` : `¿De quién es «${asiento(a)}»?`;
    const nombre = await elegirPersona(titulo, a.estado.nombre, ocupados, T.para, T.cosa);
    if (nombre === null || nombre === a.estado.nombre) return;
    archivos.forEach(otro => {
      if (otro !== a && nombre && otro.estado.nombre === nombre) Sincro.cambiar(Sincro.clave(b, otro), { nombre: '' });
    });
    Sincro.cambiar(Sincro.clave(b, a), { nombre });
  }

  async function elegirSoy() {
    const nombre = await elegirPersona('¿Quién eres? (solo en este móvil)', soy(), {});
    if (nombre === null) return;
    ponerSoy(nombre);
    App.refresh();
  }

  // A pantalla completa sobre blanco, para enseñarlo en el torno. Se cierra tocando.
  function ampliar(a) {
    const dialog = document.createElement('dialog');
    dialog.className = 'billete-grande';
    const quien = a.estado && a.estado.nombre;
    dialog.innerHTML = html`${quien ? html`<p class="grande-quien">${Piezas.avatar(quien, 'mini')}<b>${quien}</b></p>` : ''}
      <p>${a.nombre}</p><img src="${a.url}" alt="${a.nombre}">
      <small>Toca para cerrar · sube el brillo</small>`;
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', () => dialog.close());
    U.modal(dialog);
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

  // Para las tarjetas de billete: «15-B» si en este móvil has dicho quién eres y tienes asiento en ese billete.
  function miAsiento(b) {
    const yo = soy();
    if (!yo) return '';
    const mio = Datos.archivosBillete(b).find(a => Sincro.item(Sincro.clave(b, a)).nombre === yo);
    return mio ? asiento(mio) : '';
  }

  // soy / ponerSoy / elegirSoy también los usa el calendario (la franja del grupo).
  return { nav: 'billetes', render, actual: () => actual, miAsiento, soy, ponerSoy, elegirSoy, textos };
})();
