(function () {
  const container = document.getElementById('news-grid');
  const statusEl = document.getElementById('news-status');
  if (!container) return;

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  }

  async function loadNews() {
    try {
      setStatus('Loading news...');
      const res = await fetch('data/news/news.json'); // from site root
      if (!res.ok) {
        setStatus('No news feed available yet.');
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) {
        setStatus('No news items yet.');
        return;
      }

      // newest first just in case
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      container.innerHTML = '';

      items.slice(0, 10).forEach((item) => {
        const card = document.createElement('article');
        card.className = 'event-card'; // reuse styling

        const body = document.createElement('div');
        body.className = 'event-card-body';

        const dateEl = document.createElement('div');
        dateEl.className = 'event-card-date';
        dateEl.textContent = item.date ? new Date(item.date).toLocaleString() : '';

        const titleEl = document.createElement('h3');
        titleEl.className = 'event-card-title';
        titleEl.textContent = item.subject || '(no subject)';
/*
        const metaEl = document.createElement('div');
        metaEl.className = 'event-card-meta';
        metaEl.textContent = item.from || '';
*/
        const snippetEl = document.createElement('div');
        snippetEl.className = 'event-card-meta';
        snippetEl.textContent = item.skinnyBody || '';

        // Clickable: expand/collapse full snippet
        card.addEventListener('click', () => {
          card.classList.toggle('expanded');
          if (card.classList.contains('expanded')) {
            snippetEl.style.whiteSpace = 'normal';
          } else {
            snippetEl.style.whiteSpace = 'nowrap';
            snippetEl.style.textOverflow = 'ellipsis';
            snippetEl.style.overflow = 'hidden';
          }
        });

        body.appendChild(dateEl);
        body.appendChild(titleEl);
        if (item.from) body.appendChild(metaEl);
        body.appendChild(snippetEl);

        // simple thumbnail marker on the left to differentiate from events
        const thumb = document.createElement('div');
        thumb.className = 'event-card-thumb';
        thumb.innerHTML = '<span>📰</span>';

        card.appendChild(thumb);
        card.appendChild(body);
        container.appendChild(card);
      });

      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus('Error loading news. Please try again later.');
    }
  }

  loadNews();
})();

