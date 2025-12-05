// Simple bootstrap + helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];


const App = {
  config: null,
  async init() {
    const y = new Date().getFullYear();
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = y;

    this.config = await (await fetch('data/site-config.json')).json();
    const modules = await (await fetch('data/modules.json')).json();

    const host = document.getElementById('frontpage');

    for (const mod of modules.frontpage) {
      if (mod === 'events-grid') {
        const el = document.createElement('section');
        el.className = 'card front-section front-events';
        el.innerHTML = `
          <header class="front-section-header">
            <h2>Upcoming Events</h2>
            <p class="muted">What’s coming up in the next few weeks</p>
          </header>
          <div id="events-grid" class="events-grid"></div>
        `;
        host.appendChild(el);
        await EventsGrid.render('#events-grid', this.config.calendar || {});
      }

      if (mod === 'news-grid') {
        const el = document.createElement('section');
        el.className = 'card front-section front-news';
        el.innerHTML = `
          <header class="front-section-header">
            <h2>News</h2>
            <p class="muted">Latest updates tagged with "[CHAMP: News]" from the community inbox.</p>
          </header>
          <div id="news-grid" class="events-grid"></div>
          <div id="news-status" class="status" style="margin-top: 8px;"></div>
        `;
        host.appendChild(el);
      }

      if (mod === 'links-grid') {
        const el = document.createElement('section');
        el.className = 'card front-section front-links';
        el.innerHTML = `
          <header class="front-section-header">
            <h2>Important Links</h2>
            <p class="muted">Docs, community spaces, and resources</p>
          </header>
          <div id="links-grid"></div>
        `;
        host.appendChild(el);
        LinksGrid.render('#links-grid', this.config.links || {});
      }

      if (mod === 'suggestion-box') {
    const el = document.createElement('section');
    el.className = 'card front-section front-suggestions';
    el.innerHTML = `
      <header class="front-section-header">
        <h2>Suggestion Box</h2>
        <p class="muted">
          Share ideas, feedback, or wishes for C.H.A.M.P. (anonymous by default).
        </p>
      </header>
      <div id="suggestion-box"></div>
    `;
    host.appendChild(el);
    SuggestionBox.mount('#suggestion-box', this.config.suggestionBox || {});
     } 
    }
  }
};;

window.addEventListener('DOMContentLoaded', () => App.init());;