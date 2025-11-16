// Simple bootstrap + helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];


const App = {
config: null,
async init() {
// footer year
const y = new Date().getFullYear();
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = y;


// load config and modules registry
this.config = await (await fetch('data/site-config.json')).json();
const modules = await (await fetch('data/modules.json')).json();


// render modules specified for the dashboard
const host = $('#frontpage');
if (mod === 'suggestion-box') {
const el = document.createElement('article');
el.className = 'card';
el.innerHTML = `<h2>Suggestion Box (Anonymous)</h2><div id="suggestion-box"></div>`;
host.appendChild(el);
SuggestionBox.mount('#suggestion-box', this.config.suggestionBox);
}
for (const mod of modules.frontpage) {
if (mod === 'calendar') {
const el = document.createElement('article');
el.className = 'card';
el.innerHTML = `<h2>Events Calendar</h2><div id="calendar" class="calendar"></div>`;
host.appendChild(el);
await Calendar.render('#calendar', this.config.calendar);
}
if (mod === 'proton-feed') {
const el = document.createElement('article');
el.className = 'card';
el.innerHTML = `<h2>Community Feed (Proton)</h2><div id="proton-feed" class="feed-list"></div>`;
host.appendChild(el);
await ProtonFeed.render('#proton-feed', this.config.protonFeed);
}
}
}
};


window.addEventListener('DOMContentLoaded', () => App.init());
