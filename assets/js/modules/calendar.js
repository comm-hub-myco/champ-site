// Calendar Module — reads pages/dashboard/calendar/index.json → list of event files to load
host.innerHTML = '';


const header = document.createElement('div');
header.className = 'header';
header.innerHTML = `
<button id="prev-month" aria-label="Previous Month">◀</button>
<div><strong>${view.toFormat('MMMM yyyy')}</strong></div>
<button id="next-month" aria-label="Next Month">▶</button>
`;
host.appendChild(header);


const grid = document.createElement('div');
grid.className = 'grid';


// Day-of-week headers, starting Sunday
['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
const h = document.createElement('div');
h.className = 'dow';
h.textContent = d;
grid.appendChild(h);
});


const days = monthGrid(view);
const todayKey = luxon.DateTime.local().toISODate();


// index events by ISO date
const byDay = new Map();
events.forEach(ev => {
if (ev._dt) {
const key = ev._dt.toISODate();
if (!byDay.has(key)) byDay.set(key, []);
byDay.get(key).push(ev);
}
});


days.forEach((d, i) => {
const cell = document.createElement('div');
cell.className = 'cell';
const inMonth = d.month === view.month;
if (!inMonth) cell.style.opacity = .45;


const dateLabel = document.createElement('div');
dateLabel.className = 'date';
dateLabel.textContent = d.day;
if (d.toISODate() === todayKey) dateLabel.style.color = '#fff';
cell.appendChild(dateLabel);


const key = d.toISODate();
const items = byDay.get(key) || [];
items.forEach(ev => {
const pill = document.createElement('a');
pill.className = 'event-pill';
pill.href = ev.link || '#';
pill.target = ev.link ? '_blank' : '_self';
const t = ev.time ? ` @ ${ev.time}` : '';
pill.innerHTML = `<span class="t">${ev.title}${t}</span><br><span class="l">${ev.location || ''}</span>`;
cell.appendChild(pill);
});


grid.appendChild(cell);
});


host.appendChild(grid);


// nav
$('#prev-month', host.parentElement)?.addEventListener('click', () => {
const prev = view.minus({ months: 1 });
renderCalendar(host, prev, events);
});
$('#next-month', host.parentElement)?.addEventListener('click', () => {
const next = view.plus({ months: 1 });
renderCalendar(host, next, events);
});
}


return {
async render(selector, config={}) {
const host = document.querySelector(selector);
if (!host) return;
const events = await loadEvents();
const view = luxon.DateTime.local();
renderCalendar(host, view, events);
}
};
})();
