// Arranque, rutas (#/...), tema y bloqueo. Cada pantalla es { nav, render(root, arg), key(e) }.
const App = (() => {
  const { $ } = U;
  const ROUTES = { '': Calendario, dia: Dia, excursiones: Excursiones, excursion: Excursiones, billetes: Billetes,
    info: Info, mapa: Mapa, guia: Guia, alojamientos: Alojamientos };
  let current = null;
  let lastHash = null;

  function route() {
    const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    let arg = rest.join('/');
    try { arg = decodeURIComponent(arg); } catch {}
    if (name === 'hoy') {
      location.replace('#/dia/' + diaDeHoy());
      return;
    }
    // Si queda alguna ventana abierta (p. ej. un billete en grande), se cierra sin volver atrás en el historial.
    document.querySelectorAll('dialog[open]').forEach(d => {
      d.dataset.sinAtras = '1';
      d.close();
    });
    current = ROUTES[name] || Calendario;
    if (Datos.V.invitado && current === Billetes) current = Calendario;
    const root = document.createElement('div');
    root.className = 'screen';
    $('#view').replaceChildren(root);
    current.render(root, arg);
    document.querySelectorAll('[data-nav]').forEach(link => {
      const on = link.dataset.nav === current.nav;
      link.classList.toggle('on', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (location.hash !== lastHash) {
      lastHash = location.hash;
      scrollTo(0, 0);
    }
  }
  window.addEventListener('hashchange', route);

  // Hoy, si estamos de viaje; si no, el primer o el último día.
  function diaDeHoy() {
    const hoy = U.today(), V = Datos.V;
    if (hoy < V.inicio) return V.inicio;
    if (hoy > V.fin) return V.fin;
    return hoy;
  }

  // Cambiar de pantalla sin añadir una entrada al historial (día anterior y siguiente).
  const replace = hash => location.replace(hash);
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-replace]');
    if (!link || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    replace(link.getAttribute('href'));
  });

  // Botones Resumen | Detalle del plan: se guarda y se repinta la misma pantalla (sin volver arriba).
  document.addEventListener('click', e => {
    const boton = e.target.closest('[data-modo]');
    if (!boton) return;
    Piezas.cambiarModo(boton.dataset.modo);
    route();
  });

  document.addEventListener('keydown', e => {
    if (!current || !current.key || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    current.key(e);
  });

  // ---------- Tema ----------
  const THEME_KEY = 'viaje:tema';
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }

  // ---------- Paleta ----------
  // Las paletas están en css/styles.css (:root[data-paleta=…]); aquí, su nombre y los colores de muestra.
  const PALETAS = {
    mugiwara: {"nombre": "Rojo Mugiwara", "claro": "#d62828", "oscuro": "#ff5a4e", "fondo": "#fbf6ec", "fondoOscuro": "#15110f"},
    aizome: {"nombre": "Índigo aizome", "claro": "#2b4c9b", "oscuro": "#7ea2ff", "fondo": "#f4f5f8", "fondoOscuro": "#0f1219"},
    sakura: {"nombre": "Sakura", "claro": "#c8457a", "oscuro": "#ff86b5", "fondo": "#fbf5f6", "fondoOscuro": "#161114"},
    matcha: {"nombre": "Matcha", "claro": "#4a7a2c", "oscuro": "#9bcf6a", "fondo": "#f5f6ef", "fondoOscuro": "#11140f"},
    neon: {"nombre": "Neón Tokio", "claro": "#7b2ff7", "oscuro": "#ff3d9a", "fondo": "#f5f3fa", "fondoOscuro": "#0b0a12"},
  };
  function elegirPaleta() {
    const actual = document.documentElement.dataset.paleta;
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = U.html`<form method="dialog">
      <h2>Colores de la app</h2>
      <div class="paletas">${Object.entries(PALETAS).map(([id, p]) => U.html`
        <button type="button" class="paleta" data-paleta="${id}" aria-pressed="${id === actual}">
          <span class="muestras"><i style="background:${p.fondo}"></i><i style="background:${p.claro}"></i>
            <i style="background:${p.fondoOscuro}"></i><i style="background:${p.oscuro}"></i></span>
          <span>${p.nombre}</span>
        </button>`)}</div>
      <p class="hint">Solo en este móvil. Claro u oscuro, con el botón de al lado.</p>
      <button type="button" class="btn jojo-probar" data-jojo>ゴゴ Probar el aviso de JoJo</button>
      <div class="ask-btns"><button value="no" class="btn">Cerrar</button></div>
    </form>`;
    dialog.querySelectorAll('[data-paleta]').forEach(el => {
      el.onclick = () => {
        document.documentElement.dataset.paleta = el.dataset.paleta;
        try { localStorage.setItem('viaje:paleta', el.dataset.paleta); } catch {}
        dialog.querySelectorAll('[data-paleta]').forEach(b => b.setAttribute('aria-pressed', b === el));
        colorBarra();
      };
    });
    // Botón de prueba del easter egg (provisional).
    // Al cerrarse, la ventana hace history.back(): se abre después de ese «atrás» para que no cierre también el aviso.
    dialog.querySelector('[data-jojo]').onclick = () => {
      addEventListener('popstate', () => Jojo.avisar(true), { once: true });
      dialog.close();
    };
    U.modal(dialog);
  }
  // Color de la barra del navegador en el móvil: el fondo de la paleta.
  function colorBarra() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }

  // ---------- Bloqueo ----------
  // Solo en la página cifrada (la cerradura pone window.CERRADURA): olvida la clave guardada y vuelve a pedirla.
  function lock() {
    try { localStorage.removeItem('viaje:clave'); } catch {}
    location.reload();
  }

  function start() {
    $('#themeBtn').onclick = () => { toggleTheme(); colorBarra(); };
    $('#paletaBtn').onclick = elegirPaleta;
    colorBarra();
    $('#lockBtn').hidden = !window.CERRADURA;
    $('#lockBtn').onclick = lock;
    // Invitado: sin billetes (ni la pestaña).
    if (Datos.V.invitado) {
      const pestaña = document.querySelector('[data-nav="billetes"]');
      if (pestaña) pestaña.remove();
      document.documentElement.classList.add('invitado');
    }
    route();
    // Recordatorios con fecha y, si no hay ninguno, el easter egg de los viernes (después de que se pinte la app y de
    // la ventana de «¿Quién eres?», si la hay).
    setTimeout(() => { if (!document.querySelector('dialog[open]') && !Avisos.mostrar()) Jojo.avisar(); }, 1500);
    // Lo compartido (billetes y quién va a cada excursión): al arrancar y, con esas pantallas abiertas, cada 20 s.
    Sincro.traer();
    setInterval(() => {
      if ((current === Billetes || current === Excursiones) && document.visibilityState === 'visible') Sincro.traer();
    }, 20000);
  }

  // anterior(): el hash de la pantalla que se veía antes (durante render, aún no se ha cambiado).
  return { start, replace, refresh: route, pantalla: () => current, anterior: () => lastHash };
})();

App.start();
