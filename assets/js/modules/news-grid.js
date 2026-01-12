(function () {
  function getSiteBase() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return '/' + (parts[0] || '') + '/';
  }

  function articleUrl(id) {
    const BASE = getSiteBase();
    return `${BASE}news/article/?id=${encodeURIComponent(id)}`;
  }

  async function fetchJsonNoCache(url) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return await res.json();
  }

  function setStatus(el, msg) {
    if (el) el.textContent = msg || '';
  }

  function normalizeLabelFromSubject(raw) {
    const s = String(raw || '');
    const m = s.match(/\[CHAMP:\s*([^\]]+)\]/i);
    const label = m ? m[1].trim() : '';
    const subject = s.replace(/\s*\[CHAMP:[^\]]+\]\s*/ig, '').trim();
    return { label, subject };
  }

  function clampWords(html, maxWords) {
    // Very lightweight: strip tags to measure words, but keep original HTML for display
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ') : [];
    if (words.length <= maxWords) return { html: html || '', truncated: false };

    const clipped = words.slice(0, maxWords).join(' ') + '…';
    // Return as plain text inside a <p> to avoid half-open tags
    return { html: `<p>${escapeHtml(clipped)}</p>`, truncated: true };
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildTile(item, pinnedSet) {
    const { subject } = normalizeLabelFromSubject(item.subject || '');
    const isPinned = pinnedSet.has(String(item.id));

    const card = document.createElement('article');
    card.className = `event-card news-tile${isPinned ? ' is-pinned' : ''}`;
    card.style.cursor = 'pointer';

    const thumb = document.createElement('div');
    thumb.className = 'event-card-thumb';
    thumb.innerHTML = isPinned ? '<span>📌</span>' : '<span>📰</span>';

    const body = document.createElement('div');
    body.className = 'event-card-body';

    const dateEl = document.createElement('div');
    dateEl.className = 'event-card-date';
    dateEl.textContent = item.date ? new Date(item.date).toLocaleString() : '';

    const titleEl = document.createElement('h3');
    titleEl.className = 'event-card-title';
    titleEl.textContent = subject || '(no subject)';

    const metaEl = document.createElement('div');
    metaEl.className = 'event-card-meta';
    metaEl.textContent = item.from || '';

    const excerptEl = document.createElement('div');
    excerptEl.className = 'event-card-meta';

    // Prefer HTML body excerpt if available, else fallback to snippet/plain
    const rawHtml = item.excerptHtml || item.htmlBody || '';
    const fallback = item.snippet || '';
    const min = clampWords(rawHtml || `<p>${escapeHtml(fallback)}</p>`, 150);
    excerptEl.innerHTML = min.html;

    // collapsed style
    excerptEl.style.whiteSpace = 'nowrap';
    excerptEl.style.overflow = 'hidden';
    excerptEl.style.textOverflow = 'ellipsis';

    const readMore = document.createElement('a');
    readMore.href = articleUrl(item.id);
    readMore.className = 'news-read-more';
    readMore.textContent = 'Read More';
    readMore.addEventListener('click', (e) => e.stopPropagation());

    card.addEventListener('click', () => {
      // Expand/collapse on click
      const expanded = card.classList.toggle('expanded');
      if (expanded) {
        const max = clampWords(rawHtml || `<p>${escapeHtml(fallback)}</p>`, 500);
        excerptEl.innerHTML = max.html;

        excerptEl.style.whiteSpace = 'normal';
        excerptEl.style.overflow = 'visible';
        excerptEl.style.textOverflow = 'clip';

        // Add "...Read More" if truncated at 500
        if (max.truncated) {
          const more = document.createElement('a');
          more.href = articleUrl(item.id);
          more.textContent = ' …Read More';
          more.addEventListener('click', (e) => e.stopPropagation());
          excerptEl.appendChild(more);
        }
      } else {
        excerptEl.innerHTML = min.html;
        excerptEl.style.whiteSpace = 'nowrap';
        excerptEl.style.overflow = 'hidden';
        excerptEl.style.textOverflow = 'ellipsis';
      }
    });

    // Entire tile navigates if user clicks and it's already expanded? Keep as toggle only.
    // If you want: double-click to open article:
    card.addEventListener('dblclick', () => {
      window.location.href = articleUrl(item.id);
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

  async function initNews() {
    const container = document.getElementById('news-grid');
    const statusEl = document.getElementById('news-status');
    if (!container) return false;

    try {
      setStatus(statusEl, 'Loading news…');

      // frontpage is at repo root, so these are correct:
      const [news, archived, pinned] = await Promise.all([
        fetchJsonNoCache('data/news/news.json'),
        fetchJsonNoCache('data/news/archived.json').catch(() => ({ archived: [] })),
        fetchJsonNoCache('data/news/pinned.json').catch(() => ({ pinned: [] }))
      ]);

      const items = Array.isArray(news.items) ? news.items : [];

      const archivedIds = new Set(
        (archived.archived || archived.deleted || []).map((x) => String(x))
      );
      const pinnedIds = new Set((pinned.pinned || []).map((x) => String(x)));

      // Filter archived
      const visible = items.filter((it) => !archivedIds.has(String(it.id)));

      // Sort pinned first, then newest date
      visible.sort((a, b) => {
        const ap = pinnedIds.has(String(a.id)) ? 1 : 0;
        const bp = pinnedIds.has(String(b.id)) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return (b.date || '').localeCompare(a.date || '');
      });

      container.innerHTML = '';
      if (!visible.length) {
        setStatus(statusEl, 'No news items yet.');
        return true;
      }

      visible.slice(0, 10).forEach((item) => {
        container.appendChild(buildTile(item, pinnedIds));
      });

      setStatus(statusEl, '');
      return true;
    } catch (err) {
      console.error('[CHAMP news] Error loading:', err);
      setStatus(statusEl, 'Error loading news.');
      return true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ok = initNews();
    if (ok) return;

    // if inserted later by module injection
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (initNews() || attempts >= maxAttempts) clearInterval(interval);
    }, 300);
  });
})();
