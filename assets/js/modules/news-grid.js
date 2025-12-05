(function () {
  function typeLabel(type) {
    switch (type) {
      case 'event':
        return 'Event';
      case 'friends':
        return 'Friends';
      case 'question':
        return 'Question';
      case 'poll':
        return 'Poll';
      case 'news':
      default:
        return 'News';
    }
  }

  function initNews() {
    const container = document.getElementById('news-grid');
    const statusEl = document.getElementById('news-status');

    if (!container) {
      console.warn('[CHAMP news] #news-grid not found in DOM yet.');
      return false;
    }

    function setStatus(msg) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
    }

    async function loadNews() {
      try {
        setStatus('Loading news...');
        const res = await fetch('data/news/news.json');

        if (!res.ok) {
          console.warn('[CHAMP news] news.json fetch failed:', res.status);
          setStatus('No news feed available yet.');
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];

        if (!items.length) {
          setStatus('No news items yet.');
          return;
        }

        // Sort newest first
        items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        container.innerHTML = '';

        items.slice(0, 10).forEach((item) => {
          const type = item.type || 'news';

          const card = document.createElement('article');
          card.className = `event-card news-card news-type-${type}`; // reuse event card styling

          const thumb = document.createElement('div');
          thumb.className = 'event-card-thumb';

          if (item.thumbnail) {
            const img = document.createElement('img');
            // frontpage is repo root, thumbnail is 'gallery/images/...'
            img.src = item.thumbnail;
            img.alt = item.subject || 'News image';
            thumb.appendChild(img);
          } else {
            thumb.innerHTML = '<span>📰</span>';
          }

          const body = document.createElement('div');
          body.className = 'event-card-body';

          // Type tag pill
          const tag = document.createElement('span');
          tag.className = `news-tag news-tag-${type}`;
          tag.textContent = typeLabel(type);

          const dateEl = document.createElement('div');
          dateEl.className = 'event-card-date';
          dateEl.textContent = item.date
            ? new Date(item.date).toLocaleString()
            : '';

          const titleEl = document.createElement('h3');
          titleEl.className = 'event-card-title';
          titleEl.textContent = item.subject || '(no subject)';

          const metaEl = document.createElement('div');
          metaEl.className = 'event-card-meta';
          metaEl.textContent = item.from || '';

          const snippetEl = document.createElement('div');
          snippetEl.className = 'event-card-meta';
          snippetEl.textContent = item.skinnyBody || item.snippet || '';

          // Simple expand/collapse behavior
          snippetEl.style.whiteSpace = 'nowrap';
          snippetEl.style.overflow = 'hidden';
          snippetEl.style.textOverflow = 'ellipsis';

          card.addEventListener('click', () => {
            const expanded = card.classList.toggle('expanded');
            if (expanded) {
              snippetEl.style.whiteSpace = 'normal';
              snippetEl.style.overflow = 'visible';
              snippetEl.style.textOverflow = 'clip';
            } else {
              snippetEl.style.whiteSpace = 'nowrap';
              snippetEl.style.overflow = 'hidden';
              snippetEl.style.textOverflow = 'ellipsis';
            }
          });

          body.appendChild(tag);
          body.appendChild(dateEl);
          if (item.from) body.appendChild(metaEl);
          body.appendChild(snippetEl);

          card.appendChild(thumb);
          card.appendChild(body);
          container.appendChild(card);
        });

        setStatus('');
      } catch (err) {
        console.error('[CHAMP news] Error loading news:', err);
        setStatus('Error loading news. Please try again later.');
      }
    }

    loadNews();
    return true;
  }

  // Try once on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    const ok = initNews();
    if (ok) return;

    // If the Proton feed module injects HTML after DOMContentLoaded,
    // poll a few times for #news-grid to appear.
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (initNews() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 300);
  });
})();
