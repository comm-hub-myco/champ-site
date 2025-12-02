window.Calendar = (() => {
  const { DateTime } = luxon;

  function parseEventText(txt) {
    const ev = {};
    txt.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.+)$/);
      if (m) ev[m[1].toLowerCase()] = m[2].trim();
    });
    ev.date = ev.date || ev.when || ev.on;
    ev.title = ev.title || "Untitled Event";
    return ev;
  }

  async function loadJSON(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadText(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  async function loadEvents(basePath) {
    const base = basePath || ".";
    let manifest;
    try {
      manifest = await loadJSON(`${base}/pages/dashboard/calendar/index.json`);
    } catch (e) {
      console.warn("[Calendar] Could not load manifest:", e);
      return [];
    }

    const files = Array.isArray(manifest.events) ? manifest.events : [];
    if (!files.length) {
      console.info("[Calendar] Manifest has no events.");
      return [];
    }

    const events = [];
    for (const fname of files) {
      const path = `${base}/pages/dashboard/calendar/events/${fname}`;
      try {
        const txt = await loadText(path);
        const ev = parseEventText(txt);

        // store filename so we can build event.html?id=<filename>
        ev._file = fname;

        let dt = null;
        if (ev.date) {
          const raw = ev.time ? `${ev.date} ${ev.time}` : ev.date;
          dt = DateTime.fromFormat(raw, "yyyy-MM-dd HH:mm", { zone: "local" });
          if (!dt.isValid)
            dt = DateTime.fromFormat(raw, "yyyy-MM-dd", { zone: "local" });
          if (!dt.isValid) dt = DateTime.fromISO(ev.date, { zone: "local" });
        }
        ev._dt = dt && dt.isValid ? dt : null;

        events.push(ev);
      } catch (e) {
        console.warn("[Calendar] Failed loading event file:", path, e);
      }
    }

    events.sort((a, b) => {
      const A = a._dt ? a._dt.toMillis() : Infinity;
      const B = b._dt ? b._dt.toMillis() : Infinity;
      return A - B;
    });

    return events;
  }

  function monthGrid(dt) {
    const start = dt.startOf("month");
    const firstDow = start.weekday % 7; // Sun=0
    const gridStart = start.minus({ days: firstDow });
    return Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
  }

  function renderCalendar(el, view, events, basePath) {
    const host = typeof el === "string" ? document.querySelector(el) : el;
    host.innerHTML = "";

    const header = document.createElement("div");
    header.className = "header";
    header.innerHTML = `
      <button id="prev-month" aria-label="Previous Month">◀</button>
      <div><strong>${view.toFormat("MMMM yyyy")}</strong></div>
      <button id="next-month" aria-label="Next Month">▶</button>
    `;
    host.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "grid";

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => {
      const h = document.createElement("div");
      h.className = "dow";
      h.textContent = d;
      grid.appendChild(h);
    });

    const days = monthGrid(view);
    const todayKey = DateTime.local().toISODate();
    const byDay = new Map();

    events.forEach((ev) => {
      if (ev._dt) {
        const key = ev._dt.toISODate();
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(ev);
      }
    });

    days.forEach((d) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      const inMonth = d.month === view.month;
      if (!inMonth) cell.style.opacity = 0.45;

      const dateLabel = document.createElement("div");
      dateLabel.className = "date";
      dateLabel.textContent = d.day;
      if (d.toISODate() === todayKey) dateLabel.style.color = "#fff";
      cell.appendChild(dateLabel);

      const key = d.toISODate();
      const items = byDay.get(key) || [];
      items.forEach((ev) => {
        const pill = document.createElement("a");
        pill.className = "event-pill";

        // Link to event.html, with basePath-aware URL
        const eventPageBase = basePath || ".";
        pill.href = `${eventPageBase}/event.html?id=${encodeURIComponent(
          ev._file || ""
        )}`;
        pill.target = "_self";

        const ct = ev.time ? DateTime.fromFormat(ev.time, "HH:mm").toFormat("h:mm a") : "";
        const t = ev.time ? `@ ${ct}` : "";
        pill.innerHTML = `<span class="t">${ev.title}<br>${t}</span><br><span class="l">${
          ev.location || ""
        }</span>`;
        cell.appendChild(pill);
      });

      grid.appendChild(cell);
    });

    host.appendChild(grid);

    host.querySelector("#prev-month")?.addEventListener("click", () => {
      renderCalendar(host, view.minus({ months: 1 }), events, basePath);
    });
    host.querySelector("#next-month")?.addEventListener("click", () => {
      renderCalendar(host, view.plus({ months: 1 }), events, basePath);
    });

    if (!events.length) {
      const hint = document.createElement("div");
      hint.className = "muted";
      hint.style.marginTop = "8px";
      hint.textContent =
        "No events found. Check your events folder and manifest.";
      host.appendChild(hint);
    }
  }

  return {
    async render(selector, config = {}) {
      const host = document.querySelector(selector);
      if (!host) return;

      const basePath = config.basePath || "."; // "." from root, ".." from /calendar/
      const events = await loadEvents(basePath);
      const view = DateTime.local();
      renderCalendar(host, view, events, basePath);
    },
  };
})();;