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

  async function initNewsPage() {
    const grid = document.getElementById('news-page-grid');
    const statusEl = document.getElementById('news-page-status');
    const yearEl = document.getElementById('year');

    if (yearEl) yearEl.textContent = new Date().getFullYear();
    if (!grid) return;

    const setStatus = (msg) => {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
    };

    try {
      setStatus('Loading news…');

      // from /news/index.html → up one level
      const res = await fetch('../data/news/news.json');
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

      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      grid.innerHTML = '';

      items.forEach((item) => {
        const type = item.type || 'news';

        const article = document.createElement('article');
        article.className = `news-article-card news-type-${type}`;

        // Headline image
        if (item.thumbnail) {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'news-article-image';

          const img = document.createElement('img');
          img.alt = item.subject || 'News headline image';
          img.src = `../${item.thumbnail}`; // thumbnail is 'gallery/images/...'

          img.addEventListener('error', () => {
        // Fallback: show an icon instead of broken image
            img.replaceWith(Object.assign(document.createElement('div'), {
                className: 'image-fallback',
                textContent: '📸 HEIC Image'
            }));
          });

          imgWrap.appendChild(img);
          article.appendChild(imgWrap);
        }

        const body = document.createElement('div');
        body.className = 'news-article-body';

        const tag = document.createElement('span');
        tag.className = `news-tag news-tag-${type}`;
        tag.textContent = typeLabel(type);

        const metaBar = document.createElement('div');
        metaBar.className = 'news-article-meta';
        const dateText = item.date
          ? new Date(item.date).toLocaleString()
          : '';
        metaBar.textContent = `${dateText}${item.from ? ' · ' + item.from : ''}`;

        const title = document.createElement('h3');
        title.className = 'news-article-title';
        title.textContent = item.subject || '(no subject)';

        const snippet = document.createElement('p');
        snippet.className = 'news-article-snippet';
        snippet.textContent = item.skinnyBody || item.snippet || '';

        body.appendChild(tag);
        body.appendChild(metaBar);
        body.appendChild(title);
        body.appendChild(snippet);

        article.appendChild(body);
        grid.appendChild(article);
      });

      setStatus('');
    } catch (err) {
      console.error('[CHAMP news-page] Error loading news:', err);
      setStatus('Error loading news. Please try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', initNewsPage);
})();
