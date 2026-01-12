(function () {
  // ---------- Bootstrap ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const statusEl = document.getElementById('article-status');
  const host = document.getElementById('article');

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
  }

  function isAdmin() {
    return String(localStorage.getItem('champ_admin')) === 'true';
  }

  function getIdFromQuery() {
    const url = new URL(window.location.href);
    return url.searchParams.get('id') || '';
  }

  async function readConfig() {
    try {
      const res = await fetch('../../data/site-config.json');
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  // Robust worker POST helper (handles HTML error pages too)
  async function postWorker(endpoint, payload) {
    if (!endpoint) throw new Error('Missing worker endpoint.');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });

    const text = await res.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      // If worker/proxy returned HTML, show a better hint
      const looksLikeHtml = /^\s*</.test(text);
      if (!res.ok) {
        throw new Error(
          looksLikeHtml
            ? `Worker returned HTML (likely 404/500 page). Check endpoint URL: ${endpoint}`
            : (text || `HTTP ${res.status}`)
        );
      }
      // If OK but not JSON, still treat as error for our API contract
      throw new Error('Worker response was not valid JSON.');
    }

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || `Worker error (HTTP ${res.status}).`);
    }

    return data;
  }

  // Remove cid: images and cid: background urls (Gmail inline attachments)
  function stripCidUrls(html) {
    if (!html) return html;

    // Remove any <img ... src="cid:..."> tags entirely
    html = html.replace(/<img\b[^>]*\bsrc=["']cid:[^"']*["'][^>]*>/gi, '');

    // Remove background-image url(cid:...)
    html = html.replace(/url\(\s*["']?cid:[^)]+["']?\s*\)/gi, 'none');

    return html;
  }

  // Allow basic formatting + links; remove scripts/styles and dangerous attrs.
  function sanitizeNewsHtml(html) {
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const allowedTags = new Set([
      'A', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U',
      'UL', 'OL', 'LI', 'BLOCKQUOTE',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'DIV', 'SPAN', 'HR', 'PRE', 'CODE',
      'IMG'
    ]);

    const allowedAttr = {
      a: new Set(['href', 'title']),
      img: new Set(['src', 'alt', 'title'])
    };

    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('');

      const tag = node.tagName.toLowerCase();

      // Drop script/style entirely
      if (tag === 'script' || tag === 'style') return document.createTextNode('');

      // If tag not allowed, flatten children (preserve text)
      if (!allowedTags.has(node.tagName)) {
        const frag = document.createDocumentFragment();
        node.childNodes.forEach((ch) => frag.appendChild(clean(ch)));
        return frag;
      }

      const el = document.createElement(tag);

      // Copy only safe attrs
      const keep = allowedAttr[tag] || new Set();
      for (const attr of [...node.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (!keep.has(name)) continue;

        if (tag === 'a' && name === 'href') {
          const href = value.trim();
          if (!href || href.toLowerCase().startsWith('javascript:')) continue;
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
          continue;
        }

        if (tag === 'img' && name === 'src') {
          const src = value.trim();
          // Drop cid: images here too (belt & suspenders)
          if (!src || src.toLowerCase().startsWith('javascript:') || src.toLowerCase().startsWith('cid:')) continue;
          el.setAttribute('src', src);
          continue;
        }

        el.setAttribute(name, value);
      }

      // Optional minimal inline style support: allow only hex color
      if (tag === 'span' || tag === 'div' || tag === 'p') {
        const style = node.getAttribute('style') || '';
        const m = style.match(/color\s*:\s*([^;]+)/i);
        if (m) {
          const val = m[1].trim();
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)) el.style.color = val;
        }
      }

      node.childNodes.forEach((ch) => el.appendChild(clean(ch)));
      return el;
    }

    const frag = document.createDocumentFragment();
    doc.body.childNodes.forEach((ch) => frag.appendChild(clean(ch)));

    const tmp = document.createElement('div');
    tmp.appendChild(frag);
    return tmp.innerHTML;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadPinnedIds() {
    try {
      const res = await fetch('../../data/news/pinned.json');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.pinned) ? data.pinned.map(String) : [];
    } catch {
      return [];
    }
  }

  async function loadArticleById(id) {
    const res = await fetch('../../data/news/news.json');
    if (!res.ok) throw new Error('news.json fetch failed');

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items.find((x) => String(x.id) === String(id)) || null;
  }

  function renderArticle(item) {
    const dateStr = item.date ? new Date(item.date).toLocaleString() : '';
    const subject = item.subject || '(no subject)';
    const from = item.from || '';

    const html = item.htmlBody ? sanitizeNewsHtml(item.htmlBody) : '';
    const safeHtml = stripCidUrls(html || '');

    const plain = item.plainBody || item.snippet || '';
    const fallback = `<p>${escapeHtml(plain).replace(/\n/g, '<br>')}</p>`;

    host.innerHTML = `
      <header class="event-detail-header">
        <p class="event-detail-date">${escapeHtml(dateStr)}</p>
        <h1 class="event-detail-title">${escapeHtml(subject)}</h1>
        ${from ? `<p class="event-detail-location">${escapeHtml(from)}</p>` : ''}
      </header>

      <div id="news-admin-controls"></div>

      <div class="event-detail-body">
        ${safeHtml ? safeHtml : fallback}
      </div>
    `;
  }

  function mountAdminControls({ id, pinned, endpoints }) {
    const adminMount = document.getElementById('news-admin-controls');
    if (!adminMount) return;

    const { archiveEndpoint, pinEndpoint, unpinEndpoint } = endpoints;

    adminMount.innerHTML = `
      <div class="news-article-controls" style="display:grid; gap:10px; margin: 12px 0;">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="news-archive-btn">Archive Article</button>
          <button type="button" class="news-pin-btn">${pinned ? 'Unpin Article' : 'Pin Article'}</button>
        </div>
        <div class="status" id="news-admin-status"></div>
      </div>
    `;

    const status = adminMount.querySelector('#news-admin-status');
    const archiveBtn = adminMount.querySelector('.news-archive-btn');
    const pinBtn = adminMount.querySelector('.news-pin-btn');

    function setAdminStatus(msg) {
      if (status) status.textContent = msg || '';
    }

    archiveBtn.addEventListener('click', async () => {
      if (!archiveEndpoint) {
        setAdminStatus('Archive endpoint is not configured.');
        return;
      }

      const ok = confirm('Archive this article and remove it from the feed?');
      if (!ok) return;

      setAdminStatus('Archiving…');
      try {
        await postWorker(archiveEndpoint, { id });
        window.location.href = `../?v=${Date.now()}`;
        setAdminStatus('Archived. Returning to News…');
        setTimeout(() => (window.location.href = '../'), 700);
      } catch (e) {
        console.error(e);
        setAdminStatus(e.message || 'Archive failed.');
      }
    });

    pinBtn.addEventListener('click', async () => {
      const endpoint = pinned ? unpinEndpoint : pinEndpoint;

      if (!endpoint) {
        setAdminStatus(`${pinned ? 'Unpin' : 'Pin'} endpoint is not configured.`);
        return;
      }

      setAdminStatus(`${pinned ? 'Unpinning' : 'Pinning'}…`);

      try {
        await postWorker(endpoint, { id });
        window.location.reload();
        // update UI locally
        pinned = !pinned;
        pinBtn.textContent = pinned ? 'Unpin Article' : 'Pin Article';
        setAdminStatus(pinned ? 'Pinned.' : 'Unpinned.');
      } catch (e) {
        console.error(e);
        setAdminStatus(e.message || 'Pin/unpin failed.');
      }
    });
  }

  async function load() {
    const id = getIdFromQuery();
    if (!id) {
      setStatus('Missing article id.');
      return;
    }
    if (!host) {
      setStatus('Missing article container.');
      return;
    }

    setStatus('Loading article…');

    try {
      const [item, pinnedIds, config] = await Promise.all([
        loadArticleById(id),
        loadPinnedIds(),
        readConfig()
      ]);

      if (!item) {
        setStatus('Article not found.');
        return;
      }

      const pinned = pinnedIds.includes(String(id));
      renderArticle(item);

      // Admin controls (only if champ_admin true)
      if (isAdmin()) {
        const archiveEndpoint = config?.newsSubmission?.archiveEndpoint || '';
        const pinEndpoint = config?.newsSubmission?.pinEndpoint || '';
        const unpinEndpoint = config?.newsSubmission?.unpinEndpoint || '';

        mountAdminControls({
          id,
          pinned,
          endpoints: { archiveEndpoint, pinEndpoint, unpinEndpoint }
        });
      }

      setStatus('');
    } catch (e) {
      console.error(e);
      setStatus(e.message || 'Error loading article.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
