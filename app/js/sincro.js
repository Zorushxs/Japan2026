// Estado compartido de los billetes (de quién es cada uno y si ya se ha usado), igual en todos los móviles.
// - Se guarda en este navegador (funciona sin conexión) y, si hay base de datos (VIAJE.sincro: Firebase Realtime
//   Database), se envía y se recoge de allí. Gana el cambio más reciente de cada billete.
// - Todo va cifrado con la clave de la app (la deja la cerradura en window.CLAVE_VIAJE): en la base de datos solo hay
//   texto ilegible, y el nombre de cada entrada es un resumen (hash), no el billete.
const Sincro = (() => {
  const LOCAL = 'viaje:estado';
  const cfg = Datos.V.sincro || {};
  let estado = cargar(); // { items: { clave: { nombre, usado, t, pendiente } }, ultima }
  let enviando = false, trayendo = false, error = null;
  let alCambiar = null;

  function cargar() {
    try { return JSON.parse(localStorage.getItem(LOCAL)) || { items: {} }; } catch { return { items: {} }; }
  }
  function guardar() {
    try { localStorage.setItem(LOCAL, JSON.stringify(estado)); } catch {}
  }
  const avisar = () => { if (alCambiar) alCambiar(); };

  // Clave de un archivo de billete: «<id del billete>|<ruta del archivo>».
  const clave = (billete, archivo) => `${billete.id}|${archivo.ruta}`;
  const item = k => estado.items[k] || { nombre: '', usado: false, t: 0 };
  // Nombres ya puestos (para elegirlos rápido).
  const nombres = () => [...new Set(Object.values(estado.items).map(i => i.nombre).filter(Boolean))].sort();

  function cambiar(k, cambios) {
    estado.items[k] = { ...item(k), ...cambios, t: Date.now(), pendiente: true };
    guardar();
    avisar();
    enviar();
  }

  // ---------- Base de datos ----------
  const activo = () => Boolean(cfg.url && cfg.sala && window.CLAVE_VIAJE);
  const base = () => `${cfg.url.replace(/\/+$/, '')}/viaje/${cfg.sala}/items`;
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const deB64 = texto => Uint8Array.from(atob(texto), c => c.charCodeAt(0));

  async function resumen(k) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.sala + '|' + k));
    return b64(h).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c])).slice(0, 32);
  }
  async function cifrar(objeto) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, window.CLAVE_VIAJE,
      new TextEncoder().encode(JSON.stringify(objeto)));
    return b64(iv) + '.' + b64(datos);
  }
  async function descifrar(texto) {
    const [iv, datos] = texto.split('.');
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, window.CLAVE_VIAJE, deB64(datos));
    return JSON.parse(new TextDecoder().decode(plano));
  }

  // Envía los cambios pendientes (PATCH: solo esas entradas).
  async function enviar() {
    if (!activo() || enviando) return;
    const pendientes = Object.entries(estado.items).filter(([, v]) => v.pendiente);
    if (!pendientes.length) return;
    enviando = true;
    try {
      const cuerpo = {};
      for (const [k, v] of pendientes) {
        cuerpo[await resumen(k)] = { c: await cifrar({ k, nombre: v.nombre, usado: v.usado }), t: v.t };
      }
      const r = await fetch(base() + '.json', { method: 'PATCH', body: JSON.stringify(cuerpo) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // Solo se dan por enviados los que no han vuelto a cambiar mientras tanto.
      pendientes.forEach(([k, v]) => { if (estado.items[k].t === v.t) delete estado.items[k].pendiente; });
      estado.ultima = Date.now();
      error = null;
    } catch (e) {
      error = e;
    }
    enviando = false;
    guardar();
    avisar();
  }

  // Recoge lo de los demás y se queda con lo más reciente de cada billete.
  async function traer() {
    if (!activo() || trayendo) return;
    trayendo = true;
    try {
      const r = await fetch(base() + '.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const remoto = (await r.json()) || {};
      for (const valor of Object.values(remoto)) {
        try {
          const v = await descifrar(valor.c);
          const local = estado.items[v.k];
          if (!local || valor.t > local.t) {
            estado.items[v.k] = { nombre: v.nombre || '', usado: Boolean(v.usado), t: valor.t };
          }
        } catch {}
      }
      estado.ultima = Date.now();
      error = null;
    } catch (e) {
      error = e;
    }
    trayendo = false;
    guardar();
    avisar();
    enviar();
  }

  // «Sincronizado hace 2 min», «Sin conexión…», «Solo en este móvil…».
  function texto() {
    const pendientes = Object.values(estado.items).some(v => v.pendiente);
    if (!cfg.url) return 'Solo en este móvil: falta conectar la base de datos compartida.';
    if (!window.CLAVE_VIAJE) return 'Solo en este navegador (versión sin cifrar).';
    if (error || !navigator.onLine) return pendientes ? 'Sin conexión: los cambios se enviarán al volver.' : 'Sin conexión.';
    if (!estado.ultima) return 'Conectando…';
    const min = Math.round((Date.now() - estado.ultima) / 60000);
    return (pendientes ? 'Enviando… · ' : '') + (min < 1 ? 'Compartido · al día' : `Compartido · hace ${min} min`);
  }

  addEventListener('online', traer);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') traer(); });

  return {
    clave, item, nombres, cambiar, traer, texto, activo,
    onCambio: fn => { alCambiar = fn; },
  };
})();
