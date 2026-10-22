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
    current = ROUTES[name] || Calendario;
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

  // ---------- Bloqueo ----------
  // Solo en la página cifrada (la cerradura pone window.CERRADURA): olvida la clave guardada y vuelve a pedirla.
  function lock() {
    try { localStorage.removeItem('viaje:clave'); } catch {}
    location.reload();
  }

  function start() {
    $('#themeBtn').onclick = toggleTheme;
    $('#lockBtn').hidden = !window.CERRADURA;
    $('#lockBtn').onclick = lock;
    route();
    // Lo compartido de los billetes: al arrancar y, con la pantalla de billetes abierta, cada 20 s.
    Sincro.traer();
    setInterval(() => {
      if (current === Billetes && document.visibilityState === 'visible') Sincro.traer();
    }, 20000);
  }

  return { start, replace, refresh: route, pantalla: () => current };
})();

App.start();
