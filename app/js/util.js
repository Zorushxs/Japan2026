// Utilidades generales: DOM, HTML seguro, texto con formato, fechas, iconos, clics y avisos.
const U = (() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  // ---------- HTML seguro ----------
  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);

  // Un trozo de HTML ya construido, que no se vuelve a escapar.
  class Html {
    constructor(text) { this.text = text; }
    toString() { return this.text; }
  }
  const raw = text => new Html(String(text ?? ''));

  // El texto se escapa; el HTML (html`…` o raw) se deja tal cual; las listas se unen; null y undefined no pintan nada.
  function toHtml(value) {
    if (value instanceof Html) return value.text;
    if (Array.isArray(value)) return value.map(toHtml).join('');
    if (value === null || value === undefined) return '';
    return esc(value);
  }

  // Plantilla que escapa sola lo que le pones: html`<p>${texto}</p>`. Para condiciones, cond ? html`…` : ''.
  function html(strings, ...values) {
    let out = strings[0];
    values.forEach((value, i) => { out += toHtml(value) + strings[i + 1]; });
    return new Html(out);
  }

  // Texto de los datos con **negrita** y *cursiva* (lo demás se escapa).
  const rich = text => raw(esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>'));

  // ---------- Clics ----------
  // Cada elemento con data-act="nombre" llama a actions.nombre(elemento, evento); gana el más interior.
  function onActions(root, actions) {
    root.onclick = event => {
      const el = event.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      const action = actions[el.dataset.act];
      if (action) action(el, event);
    };
  }

  // ---------- Fechas ----------
  // Fechas locales AAAA-MM-DD, que se comparan como texto.
  const pad = n => String(n).padStart(2, '0');
  const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parse = day => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  };
  const today = () => iso(new Date());
  function addDays(day, n) {
    const date = parse(day);
    date.setDate(date.getDate() + n);
    return iso(date);
  }
  const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 864e5);
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
    'noviembre', 'diciembre'];
  const dow = day => DOW[parse(day).getDay()];
  const dowShort = day => dow(day).slice(0, 3);
  const monthName = month => MONTHS[month];
  // «domingo 25 de octubre»
  const fmtLong = day => `${dow(day)} ${parse(day).getDate()} de ${MONTHS[parse(day).getMonth()]}`;
  // «dom 25 oct»
  const fmtShort = day => `${dowShort(day)} ${parse(day).getDate()} ${MONTHS[parse(day).getMonth()].slice(0, 3)}`;

  // ---------- Iconos ----------
  const svg = body => raw(`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`);
  const ICON = {
    left: svg('<path d="M14.5 6l-6 6 6 6"/>'),
    right: svg('<path d="M9.5 6l6 6-6 6"/>'),
    close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    out: svg('<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10"/>'),
    pin: svg('<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    route: svg('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>'),
    home: svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V19.5h12V9.5"/><path d="M10 19.5v-5h4v5"/>'),
    bag: svg('<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8"/>'),
    ticket: svg('<path d="M4 7h16v3.5a1.5 1.5 0 0 0 0 3V17H4v-3.5a1.5 1.5 0 0 0 0-3z"/><path d="M14.5 7.5v9" stroke-dasharray="1.6 2.2"/>'),
    download: svg('<path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14"/>'),
    info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  };

  // Mensaje breve abajo de la pantalla.
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, Math.max(3000, message.length * 60));
  }

  return {
    $, esc, html, raw, rich, onActions,
    iso, parse, today, addDays, daysBetween, dow, dowShort, monthName, fmtLong, fmtShort,
    ICON, toast,
  };
})();
