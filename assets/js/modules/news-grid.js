(function () {
  /* ----------------------------
     Helpers
  ---------------------------- */

  function cleanSubject(raw) {
    return (raw || '')
      .toString()
      .replace(/\[\s*CHAMP\s*:\s*[^\]]+\]/gi, '') // remove [CHAMP: ...]
      .replace(/~?\[CHAMP[^]]*\]~?/gi, '')       // remove ~[CHAMP]~ variants
      .trim()
      .replace(/^[-–—:]+/, '')
      .trim();
  }

  function getSiteBase() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return '/' + (parts[0] || '') + '/';
  }

  function articleUrl(id) {
    const BASE = getSiteBase();
    return `${BASE}news/article/?id=${encodeURIComponent(id)}`;
  }

  function stripCidUrls(html) {
    if (!html) return '';
    let out = String(html);
    out = out.replace(/<img\b[^>]*\bsrc=["']cid:[^"']*["'][^>]*>/gi, '');
    out = out.replace(/url\(\s*["']?cid:[^)]+["']?\s*\)/gi, 'none');
    return out;
  }

  function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncateWords(text, maxWords) {
    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return { text: text || '', truncated: false };
    return { text: words.slice(0, maxWords).join(' '), truncated: true };
  }

  async function fetchJsonNoCache(url) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return await res.json();
  }

  async function fetchJsonSoft(url, fallback) {
    try {
      return await fetchJsonNoCache(url);
    } catch {
      return fallback;
    }
  }

  function safeThumbSrc(thumbnail) {
    if (!thumbnail) return '';
    if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
    return thumbnail.replace(/^\/+/, '');
  }

  function setStatus(el, msg) {
    if (el) el.textContent = msg || '';
  }

  function findHostEls() {
    // Support multiple possible homepage IDs/classes so you don’t have to match exactly.
    const container =
      document.getElementById('news-grid') ||
      document.getElementById('front-news-grid') ||
      document.getElementById('homepage-news-grid') ||
      document.querySelector('[data-news-grid]') ||
      document.querySelector('.news-grid');

    const statusEl =
      document.getElementById('news-status') ||
      document.getElementById('front-news-status') ||
      document.querySelector('[data-news-status]') ||
      document.querySelector('.news-status');

    return { container, statusEl };
  }

  /* ----------------------------
     Tile Builder
  ---------------------------- */

  function buildTile(item) {
    const card = document.createElement('article');
    card.className = 'event-card news-tile';
    card.style.cursor = 'pointer';

    const thumb = document.createElement('div');
    thumb.className = 'event-card-thumb';

    if (item.thumbnail) {
      const img = document.createElement('img');
      img.alt = item.subject || 'News thumbnail';
      img.src = safeThumbSrc(item.thumbnail);
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';

      img.addEventListener('error', () => {
        thumb.innerHTML = '<span>📰</span>';
      });

      thumb.appendChild(img);
    } else {
      thumb.innerHTML = '<span>📰</span>';
    }

    const body = document.createElement('div');
    body.className = 'event-card-body';

    const dateEl = document.createElement('div');
    dateEl.className = 'event-card-date';
    dateEl.textContent = item.date ? new Date(item.date).toLocaleString() : '';

    const titleEl = document.createElement('h3');
    titleEl.className = 'event-card-title';
    titleEl.textContent = cleanSubject(item.subject || item.subjectRaw || '(no subject)');

    const metaEl = document.createElement('div');
    metaEl.className = 'event-card-meta';
    metaEl.textContent = item.from || '';

    const rawHtml = stripCidUrls(item.htmlBody || '');
    const fullText = rawHtml ? htmlToText(rawHtml) : (item.snippet || '');

    const MIN_WORDS = 150;
    const MAX_WORDS = 500;

    const minSlice = truncateWords(fullText, MIN_WORDS);
    const maxSlice = truncateWords(fullText, MAX_WORDS);

    const excerptEl = document.createElement('div');
    excerptEl.className = 'event-card-meta';
    excerptEl.textContent = minSlice.text;
    excerptEl.style.whiteSpace = 'nowrap';
    excerptEl.style.overflow = 'hidden';
    excerptEl.style.textOverflow = 'ellipsis';

    const readMore = document.createElement('a');
    readMore.href = articleUrl(item.id);
    readMore.className = 'news-read-more';
    readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
    readMore.addEventListener('click', (e) => e.stopPropagation());

    // Expand/collapse
    card.addEventListener('click', () => {
      const expanded = card.classList.toggle('expanded');
      if (expanded) {
        excerptEl.textContent = maxSlice.text;
        excerptEl.style.whiteSpace = 'normal';
        excerptEl.style.overflow = 'visible';
        excerptEl.style.textOverflow = 'clip';
        readMore.textContent = maxSlice.truncated ? '...Read More' : 'Read More';
      } else {
        excerptEl.textContent = minSlice.text;
        excerptEl.style.whiteSpace = 'nowrap';
        excerptEl.style.overflow = 'hidden';
        excerptEl.style.textOverflow = 'ellipsis';
        readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
      }
    });

    body.appendChild(dateEl);
    body.appendChild(titleEl);
    if (item.from) body.appendChild(metaEl);
    body.appendChild(excerptEl);
    body.appendChild(readMore);

    card.appendChild(thumb);
    card.appendChild(body);
    return card;
  }

  /* ----------------------------
     Main
  ---------------------------- */

  async function initNewsGrid() {
    const { container, statusEl } = findHostEls();

    if (!container) {
      // Silent by default, but this is your smoking gun for “nothing renders”
      console.warn('[CHAMP news-grid] No container found. Expected #news-grid or [data-news-grid] or .news-grid.');
      return false;
    }

    try {
      setStatus(statusEl, 'Loading news...');

      const [newsData, archivedData, pinnedData] = await Promise.all([
        fetchJsonNoCache('data/news/news.json'),
        fetchJsonSoft('data/news/archived.json', null),
        fetchJsonSoft('data/news/pinned.json', { pinned: [] })
      ]);

      let archivedObj = archivedData;
      if (!archivedObj) {
        archivedObj = await fetchJsonSoft('data/news/deleted.json', { deleted: [] });
      }

      const rawItems = Array.isArray(newsData.items) ? newsData.items : [];
      console.log('[CHAMP news-grid] fetched items:', rawItems.length);

      if (!rawItems.length) {
        container.innerHTML = '';
        setStatus(statusEl, 'No news items yet.');
        return true;
      }

      const archivedIds = new Set(
        (archivedObj.archived || archivedObj.deleted || []).map((x) => String(x))
      );
      const pinnedIds = new Set((pinnedData.pinned || []).map((x) => String(x)));

      const items = rawItems
        .filter((it) => !archivedIds.has(String(it.id)))
        .map((it) => ({ ...it, pinned: pinnedIds.has(String(it.id)) }));

      console.log('[CHAMP news-grid] after archive filter:', items.length);

      if (!items.length) {
        container.innerHTML = '';
        setStatus(statusEl, 'No news items (all archived).');
        return true;
      }

      items.sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (bp !== ap) return bp - ap;
        return (b.date || '').localeCompare(a.date || '');
      });

      container.innerHTML = '';
      items.slice(0, 10).forEach((item) => container.appendChild(buildTile(item)));
      setStatus(statusEl, '');

      console.log('[CHAMP news-grid] rendered tiles:', Math.min(10, items.length));
      return true;
    } catch (err) {
      console.error('[CHAMP news-grid] load failed:', err);
      setStatus(statusEl, 'Error loading news.');
      return true;
    }
  }

  function boot() {
    // Run immediately regardless of DOMContentLoaded timing.
    initNewsGrid();

    // Also retry briefly in case homepage injects the container late.
    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(() => {
      attempts++;
      const { container } = findHostEls();
      if (container && container.children && container.children.length) {
        clearInterval(interval);
        return;
      }
      initNewsGrid();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
