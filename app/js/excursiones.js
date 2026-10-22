// Excursiones (#/excursiones) y el plan de cada una (#/excursion/<id>), con «¿Quién va?»: cada persona va, quizá o no
// a cada excursión (VIAJE.quienVa es el punto de partida; los cambios se comparten con Sincro, como los billetes).
// Cada uno cambia lo suyo (según «Soy: …»); los de VIAJE.admins, lo de todos.
const Excursiones = (() => {
  const { html, rich } = U;
  const V = Datos.V;
  const ESTADOS = ['si', 'quizas', 'no'];
  const TEXTO = { si: 'va', quizas: 'quizá', no: 'no va' };

  function render(root, id) {
    const e = id && Datos.excursion(id);
    if (e) detalle(root, e);
    else lista(root);
    U.onActions(root, {
      va(el) {
        const fila = filaQV(el.dataset.exc), nombre = el.dataset.nombre;
        if (!puede(nombre)) return;
        const siguiente = ESTADOS[(ESTADOS.indexOf(estado(fila, nombre)) + 1) % ESTADOS.length];
        Sincro.cambiar(claveQV(fila.id, nombre), { valor: siguiente });
      },
    });
    Sincro.onCambio(repintarQV, 'excursiones');
  }

  function lista(root) {
    const grupo = (titulo, desde, nota) => html`<section class="bloque">
      <h2 class="h2">${titulo}</h2>
      ${nota ? html`<p class="hint">${nota}</p>` : ''}
      <div class="excs">${V.excursiones.filter(e => e.desde === desde).map(Piezas.excursion)}</div>
    </section>`;
    root.innerHTML = html`
      <h1 class="h">Excursiones</h1>
      ${filasQV().length ? html`<section class="bloque"><h2 class="h2">¿Quién va?</h2>
        <p class="hint">${ayudaQV()}</p>
        <div data-qv="">${quienVa(filasQV(), true)}</div></section>` : ''}
      ${grupo('Desde Tokio · 9–13 nov', 'Tokio', 'Días de excursiones cruzadas: el grupo se divide y cada uno elige.')}
      ${grupo('Desde Osaka', 'Osaka')}`;
  }

  function detalle(root, e) {
    const mapas = Datos.mapasExcursion(e);
    const dias = Datos.diasDe(e.id);
    const fila = filaQV(e.id);
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
        ${fila ? html`<div data-qv="${e.id}">${quienVa([fila], false)}</div>` : ''}
        ${mapas.map(m => Piezas.mapa(m, null))}
        ${Piezas.cabeceraPlan()}
        ${Piezas.plan(e.plan, Datos.numeros(mapas))}
      </div>`;
  }

  // ---------- ¿Quién va? ----------
  // Filas de VIAJE.quienVa: { id, si: [nombres], quizas?: [nombres] } y, si no es una excursión, { titulo, emoji }.
  const filasQV = () => V.quienVa || [];
  const filaQV = id => filasQV().find(f => f.id === id);
  const claveQV = (id, nombre) => `va|${id}|${nombre}`;
  const esAdmin = yo => (V.admins || []).includes(yo);
  const puede = nombre => Boolean(Billetes.soy()) && (Billetes.soy() === nombre || esAdmin(Billetes.soy()));
  function ayudaQV() {
    const yo = Billetes.soy();
    if (!yo) return 'Di quién eres (en el calendario) para apuntarte. Lo ve todo el grupo.';
    return esAdmin(yo) ? 'Toca a cualquiera para cambiarlo: va → quizá → no va. Lo ve todo el grupo.'
      : 'Toca tu cara para cambiarlo: va → quizá → no va. Lo ve todo el grupo.';
  }
  // Lo último que se haya cambiado en algún móvil; si nadie lo ha tocado, lo de los datos.
  function estado(fila, nombre) {
    const it = Sincro.item(claveQV(fila.id, nombre));
    if (it.t && ESTADOS.includes(it.valor)) return it.valor;
    if ((fila.si || []).includes(nombre)) return 'si';
    return (fila.quizas || []).includes(nombre) ? 'quizas' : 'no';
  }

  function quienVa(filas, conTitulo) {
    const yo = Billetes.soy();
    return html`<div class="qv">${filas.map(fila => {
      const e = Datos.excursion(fila.id);
      const estados = (V.grupo || []).map(nombre => ({ nombre, est: estado(fila, nombre) }));
      const n = est => estados.filter(p => p.est === est).length;
      const cuenta = `${n('si')} ${n('si') === 1 ? 'va' : 'van'}${n('quizas') ? ` · ${n('quizas')} quizá` : ''}`;
      const titulo = e ? `${e.emoji} ${e.titulo}` : `${fila.emoji || ''} ${fila.titulo}`;
      return html`<div class="qv-fila">
        <p class="qv-cab">${conTitulo
          ? (e ? html`<a href="#/excursion/${e.id}">${titulo}</a>` : html`<b>${titulo}</b>`)
          : html`<b>¿Quién va?</b>`}<small>${cuenta}</small></p>
        <div class="qv-caras">${estados.map(p => html`<button class="qv-p qv-${p.est} ${p.nombre === yo ? 'qv-yo' : ''}"
          data-act="va" data-exc="${fila.id}" data-nombre="${p.nombre}" ${puede(p.nombre) ? '' : 'disabled'} aria-label="${p.nombre}: ${TEXTO[p.est]}"
          title="${p.nombre}: ${TEXTO[p.est]}">
          <span class="qv-av">${Piezas.avatar(p.nombre)}<i class="qv-marca" aria-hidden="true"></i></span>
          <span class="qv-nom">${p.nombre}</span></button>`)}</div>
      </div>`;
    })}</div>
    <p class="hint sincro">${Sincro.texto()}</p>`;
  }

  // Al llegar cambios (propios o de otro móvil), solo se repinta la tabla: el resto de la pantalla no se mueve.
  function repintarQV() {
    if (App.pantalla() !== Excursiones) return;
    document.querySelectorAll('[data-qv]').forEach(el => {
      const id = el.dataset.qv;
      el.innerHTML = id ? quienVa([filaQV(id)], false) : quienVa(filasQV(), true);
    });
  }

  return { nav: 'excursiones', render };
})();
