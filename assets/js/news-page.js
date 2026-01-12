(function () {
  // ----------------------------
  // Labels / Routing helpers
  // ----------------------------
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
      case 'in-the-news':
        return 'In the News';
      case 'announcement':
        return 'Announcement';
      case 'updates':
        return 'Updates';
      case 'field-notes':
        return 'Field Notes';
      case 'ideas':
        return 'Ideas';
      case 'admin':
        return 'Admin';
      case 'qa':
        return 'Q & A';
      default:
        return 'News';
    }
  }

  // Controls ordering in filter dropdown
  const TYPE_ORDER = [
    'announcement',
    'updates',
    'field-notes',
    'in-the-news',
    'ideas',
    'admin',
    'qa',
    'event',
    'friends',
    'question',
    'poll'
  ];

  function normalizeType(type) {
    const t = (type || '').toString().trim().toLowerCase();

    // Back-compat / normalization
    if (t === 'in the news' || t === 'in_the_news') return 'in-the-news';
    if (t === 'q&a' || t === 'q & a' || t === 'q and a' || t === 'qanda') return 'qa';

    // If anything was previously "news", treat it as field-notes (per your instruction)
    if (t === 'news') return 'field-notes';

    return t || 'field-notes';
  }

  function cleanSubject(raw) {
    return (raw || '')
      .toString()
      .replace(/\[\s*CHAMP\s*:\s*[^\]]+\]/gi, '') // remove [CHAMP: ...]
      .replace(/~?\[CHAMP[^]]*\]~?/gi, '') // remove ~[CHAMP]~ variants
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

  // ----------------------------
  // Fetch helpers (cache busting)
  // ----------------------------
  async function fetchJsonNoCache(url) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return await res.json();
  }

  async function fetchJsonNoCacheSoft(url, fallback) {
    try {
      return await fetchJsonNoCache(url);
    } catch {
      return fallback;
    }
  }

  // ----------------------------
  // Content helpers
  // ----------------------------
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

  function safeRelativeThumbSrc(thumbnail) {
    if (!thumbnail) return '';
    if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
    return `../${thumbnail.replace(/^\/+/, '')}`;
  }

  // ----------------------------
  // Tile builder
  // ----------------------------
  function buildNewsTile(item) {
    const type = normalizeType(item.type);

    const card = document.createElement('article');
    card.className = `news-article-card news-type-${type}${item.pinned ? ' is-pinned' : ''}`;
    card.style.cursor = 'pointer';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Open article: ${item.subject || 'News item'}`);

    if (item.thumbnail) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'news-article-image';

      const img = document.createElement('img');
      img.alt = item.subject || 'News headline image';
      img.src = safeRelativeThumbSrc(item.thumbnail);

      img.addEventListener('error', () => {
        img.replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'image-fallback',
            textContent: '📸'
          })
        );
      });

      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    const body = document.createElement('div');
    body.className = 'news-article-body';

    const tag = document.createElement('span');
    tag.className = `news-tag news-tag-${type}`;
    tag.textContent = typeLabel(type);

    const metaBar = document.createElement('div');
    metaBar.className = 'news-article-meta';
    const dateText = item.date ? new Date(item.date).toLocaleString() : '';
    metaBar.textContent = `${dateText}${item.from ? ' · ' + item.from : ''}`;

    const title = document.createElement('h3');
    title.className = 'news-article-title';
    title.textContent = cleanSubject(item.subject || item.subjectRaw || '(no subject)');

    const rawHtml = stripCidUrls(item.htmlBody || item.excerptHtml || '');
    const fallbackText = item.snippet || item.body || '';
    const fullTextForTrunc = rawHtml ? htmlToText(rawHtml) : fallbackText;

    const MIN_WORDS = 150;
    const MAX_WORDS = 500;

    const snipWrap = document.createElement('div');
    snipWrap.className = 'news-article-snippet';

    const minSlice = truncateWords(fullTextForTrunc, MIN_WORDS);
    const maxSlice = truncateWords(fullTextForTrunc, MAX_WORDS);

    snipWrap.textContent = minSlice.text;

    const readMore = document.createElement('a');
    readMore.href = articleUrl(item.id);
    readMore.className = 'news-read-more';
    readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
    readMore.addEventListener('click', (e) => e.stopPropagation());

    const expandHint = document.createElement('div');
    expandHint.className = 'news-expand-hint muted';
    expandHint.style.fontSize = '0.85rem';
    expandHint.style.marginTop = '6px';
    expandHint.textContent = minSlice.truncated ? 'Click to expand' : '';

    body.appendChild(tag);
    body.appendChild(metaBar);
    body.appendChild(title);
    body.appendChild(snipWrap);
    body.appendChild(readMore);
    if (expandHint.textContent) body.appendChild(expandHint);

    card.appendChild(body);

    // Expand/collapse on click (keep your behavior)
    card.addEventListener('click', () => {
      const expanded = card.classList.toggle('expanded');
      if (expanded) {
        snipWrap.textContent = maxSlice.text;
        readMore.textContent = maxSlice.truncated ? '...Read More' : 'Read More';
        expandHint.textContent = 'Click to collapse';
      } else {
        snipWrap.textContent = minSlice.text;
        readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
        expandHint.textContent = minSlice.truncated ? 'Click to expand' : '';
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });

    return card;
  }

  // ----------------------------
  // Filter UI
  // ----------------------------
  function getAllTypes(items) {
    const set = new Set();
    items.forEach((it) => set.add(normalizeType(it.type)));
    const known = TYPE_ORDER.filter((t) => set.has(t));
    const unknown = [...set].filter((t) => !TYPE_ORDER.includes(t)).sort();
    return [...known, ...unknown];
  }

  function mountFilters({ host, types, onChange }) {
    host.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'news-filter-wrap';

    const label = document.createElement('div');
    label.className = 'news-filter-label';
    label.textContent = 'Filter:';

    const select = document.createElement('select');
    select.className = 'news-filter-select';
    select.setAttribute('aria-label', 'Filter news by category');

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'All categories';
    select.appendChild(optAll);

    types.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = typeLabel(t);
      select.appendChild(opt);
    });

    const sortSelect = document.createElement('select');
    sortSelect.className = 'news-sort-select';
    sortSelect.setAttribute('aria-label', 'Sort order');

    const s1 = document.createElement('option');
    s1.value = 'newest';
    s1.textContent = 'Newest first';
    sortSelect.appendChild(s1);

    const s2 = document.createElement('option');
    s2.value = 'oldest';
    s2.textContent = 'Oldest first';
    sortSelect.appendChild(s2);

    const state = { type: 'all', sort: 'newest' };

    function emit() {
      onChange({ ...state });
    }

    select.addEventListener('change', () => {
      state.type = select.value;
      emit();
    });

    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      emit();
    });

    wrap.appendChild(label);
    wrap.appendChild(select);
    wrap.appendChild(sortSelect);
    host.appendChild(wrap);

    emit();
  }

  function sortItems(items, sortMode) {
    const out = [...items];
    out.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap; // pinned first
      return (b.date || '').localeCompare(a.date || '');
    });
    if (sortMode === 'oldest') out.reverse();
    return out;
  }

  // ----------------------------
  // Page init
  // ----------------------------
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

    // Ensure filters host exists
    let filtersHost = document.getElementById('news-filters');
    if (!filtersHost) {
      filtersHost = document.createElement('div');
      filtersHost.id = 'news-filters';
      filtersHost.className = 'news-filters';
      grid.parentElement?.insertBefore(filtersHost, grid);
    }

    try {
      setStatus('Loading news…');

      // Load main feed + ledgers (cache-busted)
      const [newsData, archivedData, pinnedData] = await Promise.all([
        fetchJsonNoCache('../data/news/news.json'),
        // Support either archived.json or legacy deleted.json
        fetchJsonNoCacheSoft('../data/news/archived.json', null),
        fetchJsonNoCacheSoft('../data/news/pinned.json', { pinned: [] })
      ]);

      // If archived.json doesn't exist, attempt deleted.json
      let archivedObj = archivedData;
      if (!archivedObj) {
        archivedObj = await fetchJsonNoCacheSoft('../data/news/deleted.json', { deleted: [] });
      }

      const rawItems = Array.isArray(newsData.items) ? newsData.items : [];
      if (!rawItems.length) {
        setStatus('No news items yet.');
        return;
      }

      // Build archived set
      const archivedIds = new Set(
        (archivedObj.archived || archivedObj.deleted || []).map((x) => String(x))
      );

      // Build pinned set
      const pinnedIds = new Set((pinnedData.pinned || []).map((x) => String(x)));

      // Normalize + apply archived/pinned
      const items = rawItems
        .filter((it) => !archivedIds.has(String(it.id)))
        .map((it) => ({
          ...it,
          type: normalizeType(it.type),
          pinned: pinnedIds.has(String(it.id))
        }));

      if (!items.length) {
        setStatus('No news items (all are archived).');
        grid.innerHTML = '';
        return;
      }

      const types = getAllTypes(items);

      function render({ type, sort }) {
        const sorted = sortItems(items, sort);
        const filtered = type === 'all' ? sorted : sorted.filter((it) => it.type === type);

        grid.innerHTML = '';
        if (!filtered.length) {
          setStatus('No items match that filter.');
          return;
        }

        filtered.forEach((item) => grid.appendChild(buildNewsTile(item)));
        setStatus('');
      }

      mountFilters({
        host: filtersHost,
        types,
        onChange: render
      });
    } catch (err) {
      console.error('[CHAMP news-page] Error loading news:', err);
      setStatus('Error loading news. Please try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', initNewsPage);
})();
