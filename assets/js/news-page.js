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
      case 'news':
      default:
        return 'News';
    }
  }

  function getSiteBase() {
    // GitHub Pages project site base: /champ-site/
    const parts = window.location.pathname.split('/').filter(Boolean);
    return '/' + (parts[0] || '') + '/';
  }

  function articleUrl(id) {
    const BASE = getSiteBase();
    return `${BASE}news/article/?id=${encodeURIComponent(id)}`;
  }

  // ----------------------------
  // Content helpers
  // ----------------------------
  function stripCidUrls(html) {
    // Prevent cid: fetch errors in browser (email inline images)
    if (!html) return '';
    let out = String(html);

    // Remove cid <img> tags
    out = out.replace(/<img\b[^>]*\bsrc=["']cid:[^"']*["'][^>]*>/gi, '');

    // Remove cid background images
    out = out.replace(/url\(\s*["']?cid:[^)]+["']?\s*\)/gi, 'none');

    return out;
  }

  function htmlToText(html) {
    // Convert HTML to plain text for fallback snippet
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
    // news page is /news/ so we need to go up one level to repo root
    // thumbnail is usually 'gallery/images/...'
    if (!thumbnail) return '';
    if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
    return `../${thumbnail.replace(/^\/+/, '')}`;
  }

  // ----------------------------
  // Tile builder
  // ----------------------------
  function buildNewsTile(item) {
    const type = item.type || 'news';

    const card = document.createElement('article');
    card.className = `news-article-card news-type-${type}`;
    card.style.cursor = 'pointer';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Open article: ${item.subject || 'News item'}`);

    // Headline image (optional)
    if (item.thumbnail) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'news-article-image';

      const img = document.createElement('img');
      img.alt = item.subject || 'News headline image';
      img.src = safeRelativeThumbSrc(item.thumbnail);

      // HEIC fallback (or any broken image)
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
    title.textContent = item.subject || '(no subject)';

    // Snippet: prefer htmlBody (formatted), fall back to snippet/text fields
    const rawHtml = stripCidUrls(item.htmlBody || item.excerptHtml || '');
    const fallbackText = item.snippet || item.body || '';
    const fullTextForTrunc = rawHtml ? htmlToText(rawHtml) : fallbackText;

    // Expand/collapse logic using word counts
    const MIN_WORDS = 150;
    const MAX_WORDS = 500;

    const snipWrap = document.createElement('div');
    snipWrap.className = 'news-article-snippet';

    // We render as HTML if we have it; otherwise plain text.
    // For tiles, we show truncated content (150 words) unless expanded.
    const minSlice = truncateWords(fullTextForTrunc, MIN_WORDS);
    const maxSlice = truncateWords(fullTextForTrunc, MAX_WORDS);

    // We'll store both modes; default is minimized.
    // If you want links to work in tiles, we must render HTML; but we cannot reliably
    // truncate HTML while preserving tags. So:
    // - Display minimized as plain text (safe, consistent)
    // - Display expanded as plain text up to 500 words
    // - Provide "...Read More" link to the full HTML article page
    //
    // This guarantees zero broken markup while keeping links functional via Read More.
    snipWrap.textContent = minSlice.text;

    const readMore = document.createElement('a');
    readMore.href = articleUrl(item.id);
    readMore.className = 'news-read-more';
    readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
    readMore.addEventListener('click', (e) => e.stopPropagation());

    // Expand indicator (optional UX)
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

    // Expand/collapse on tile click (does NOT navigate)
    card.addEventListener('click', () => {
      const expanded = card.classList.toggle('expanded');

      if (expanded) {
        snipWrap.textContent = maxSlice.text;
        readMore.textContent = maxSlice.truncated ? '...Read More' : 'Read More';
        if (expandHint) expandHint.textContent = 'Click to collapse';
      } else {
        snipWrap.textContent = minSlice.text;
        readMore.textContent = minSlice.truncated ? '...Read More' : 'Read More';
        if (expandHint) expandHint.textContent = minSlice.truncated ? 'Click to expand' : '';
      }
    });

    // Keyboard activation: Enter/Space expands (not navigate)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });

    return card;
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

    try {
      setStatus('Loading news…');

      // News page is /news/index.html → up one level to /champ-site/data/news/news.json
      const res = await fetch('../data/news/news.json');
      if (!res.ok) {
        setStatus('No news feed available yet.');
        return;
      }

      // Safe JSON parse so HTML 404 pages don't crash silently
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('[CHAMP news-page] news.json not JSON. Response was:', text.slice(0, 200));
        setStatus('News feed could not be loaded (invalid response).');
        return;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        setStatus('No news items yet.');
        return;
      }

      // Newest first
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      grid.innerHTML = '';
      items.forEach((item) => grid.appendChild(buildNewsTile(item)));

      setStatus('');
    } catch (err) {
      console.error('[CHAMP news-page] Error loading news:', err);
      setStatus('Error loading news. Please try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', initNewsPage);
})();
