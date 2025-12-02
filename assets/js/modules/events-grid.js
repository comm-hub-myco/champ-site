// EventsGrid — frontpage grid of upcoming events
// Reads pages/dashboard/calendar/index.json and the same .txt event files used by the calendar.

window.EventsGrid = (() => {
  const { DateTime } = luxon;

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

  async function loadJSON(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadText(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  async function loadEvents() {
    let manifest;
    try {
      manifest = await loadJSON('pages/dashboard/calendar/index.json');
    } catch (e) {
      console.warn('[EventsGrid] Could not load manifest:', e);
      return [];
    }
    const files = Array.isArray(manifest.events) ? manifest.events : [];
    const events = [];

    for (const fname of files) {
      const path = `pages/dashboard/calendar/events/${fname}`;
      try {
        const txt = await loadText(path);
        const ev = parseEventText(txt);
        ev._file = fname; // keep filename to build link later

        // parse date/time
        let dt = null;
        if (ev.date) {
          const ct = ev.time ? DateTime.fromFormat(ev.time, "HH:mm").toFormat("h:mm a") : "";
          const raw = ev.time ? `${ev.date} ${ct}` : ev.date;
          dt = DateTime.fromFormat(raw, 'yyyy-MM-dd HH:mm', { zone: 'local' });
          if (!dt.isValid) dt = DateTime.fromFormat(raw, 'yyyy-MM-dd', { zone: 'local' });
          if (!dt.isValid) dt = DateTime.fromISO(ev.date, { zone: 'local' });
        }
        ev._dt = dt && dt.isValid ? dt : null;
        events.push(ev);
      } catch (e) {
        console.warn('[EventsGrid] Failed loading event file:', path, e);
      }
    }

    return events;
  }

  function getUpcoming(events, limit = 6) {
    const today = DateTime.local().startOf('day');
    return events
      .filter(ev => ev._dt && ev._dt >= today)
      .sort((a, b) => a._dt.toMillis() - b._dt.toMillis())
      .slice(0, limit);
  }

  function formatDate(ev) {
    if (!ev._dt) return '';
    return ev._dt.toLocaleString(DateTime.DATE_MED);
  }

  function renderCard(ev) {
    const wrapper = document.createElement('a');
    wrapper.className = 'event-card';
    wrapper.href = `event.html?id=${encodeURIComponent(ev._file)}`;

    const img = document.createElement('div');
    img.className = 'event-card-thumb';
    img.setAttribute('aria-hidden', 'true');

    // Optional: if you add "Image: path/to/file.jpg" in the txt
    if (ev.image) {
      const realImg = document.createElement('img');
      realImg.src = ev.image;
      realImg.alt = '';
      img.appendChild(realImg);
    } else {
      img.innerHTML = '<span>🍄</span>';
    }

    const body = document.createElement('div');
    body.className = 'event-card-body';

    const date = document.createElement('div');
    date.className = 'event-card-date';
    date.textContent = formatDate(ev);

    const title = document.createElement('h3');
    title.className = 'event-card-title';
    title.textContent = ev.title;

    const meta = document.createElement('div');
    meta.className = 'event-card-meta';
    const time = ev.time ? ` · ${ev.time}` : '';
    const loc = ev.location ? ` · ${ev.location}` : '';
    meta.textContent = (ev.location || ev.time) ? `${time}${loc}`.replace(/^ · /, '') : '';

    body.appendChild(date);
    body.appendChild(title);
    body.appendChild(meta);

    wrapper.appendChild(img);
    wrapper.appendChild(body);

    return wrapper;
  }

  return {
    async render(selector, config = {}) {
      const host = document.querySelector(selector);
      if (!host) return;

      const events = await loadEvents();
      const upcoming = getUpcoming(events, config.limit || 6);

      if (!upcoming.length) {
        host.innerHTML = '<div class="muted">No upcoming events yet. Check back soon.</div>';
        return;
      }

      upcoming.forEach(ev => host.appendChild(renderCard(ev)));
    }
  };
})();