// Event detail page: reads ?id=<filename> and loads the event text file

(function () {
  const { DateTime } = luxon;

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const container = document.getElementById('event-detail');

  function parseEventText(txt) {
    const ev = {};
    txt.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.+)$/);
      if (m) ev[m[1].toLowerCase()] = m[2].trim();
    });
    ev.date = ev.date || ev.when || ev.on;
    ev.title = ev.title || 'Untitled Event';
    return ev;
  }

  async function loadText(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  function formatDateTime(ev) {
    if (!ev.date) return '';
    let dt = null;
    const raw = ev.time ? `${ev.date} ${ev.time}` : ev.date;
    dt = DateTime.fromFormat(raw, 'yyyy-MM-dd HH:mm', { zone: 'local' });
    if (!dt.isValid) dt = DateTime.fromFormat(raw, 'yyyy-MM-dd', { zone: 'local' });
    if (!dt.isValid) dt = DateTime.fromISO(ev.date, { zone: 'local' });
    if (!dt.isValid) return ev.date;
    const datePart = dt.toLocaleString(DateTime.DATE_FULL);
    const timePart = ev.time ? dt.toLocaleString(DateTime.TIME_SIMPLE) : '';
    return timePart ? `${datePart} · ${timePart}` : datePart;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      container.innerHTML = '<div class="muted">No event specified.</div>';
      return;
    }

    try {
      const path = `pages/dashboard/calendar/events/${id}`;
      const txt = await loadText(path);
      const ev = parseEventText(txt);

      const when = formatDateTime(ev);
      const loc = ev.location || '';
      const desc = ev.description || '';

      container.innerHTML = `
        <header class="event-detail-header">
          <p class="event-detail-date">${when}</p>
          <h2 class="event-detail-title">${ev.title}</h2>
          ${loc ? `<p class="event-detail-location">${loc}</p>` : ''}
        </header>
        <section class="event-detail-body">
          ${desc ? `<p>${desc}</p>` : '<p class="muted">No description provided.</p>'}
        </section>
        ${ev.link ? `<p><a class="event-detail-link" href="${ev.link}" target="_blank" rel="noopener">More info / RSVP</a></p>` : ''}
      `;
    } catch (e) {
      console.warn(e);
      container.innerHTML = '<div class="muted">Unable to load event details.</div>';
    }
  }

  init();
})();
