(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const statusEl = document.getElementById('article-status');
  const host = document.getElementById('article');
  if (!host) return;

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  }

  function getIdFromQuery() {
    const url = new URL(window.location.href);
    return url.searchParams.get('id') || '';
  }

  function isAdmin() {
    return localStorage.getItem('champ_admin') === 'true';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function readConfig() {
    try {
      const res = await fetch('../../data/site-config.json');
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  function stripCidUrls(html) {
    if (!html) return html;

    // Remove any <img ... src="cid:..."> tags entirely
    html = html.replace(/<img\b[^>]*\bsrc=["']cid:[^"']*["'][^>]*>/gi, '');

    // Remove css url(cid:...)
    html = html.replace(/url\(\s*["']?cid:[^)]+["']?\s*\)/gi, 'none');

    return html;
  }

  // Allow basic formatting + links + images. Remove scripts/styles and dangerous attrs.
  function sanitizeNewsHtml(html) {
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const allowedTags = new Set([
      'A','P','BR','B','STRONG','I','EM','U',
      'UL','OL','LI','BLOCKQUOTE',
      'H1','H2','H3','H4','H5','H6',
      'DIV','SPAN','HR','PRE','CODE',
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

      if (tag === 'script' || tag === 'style') return document.createTextNode('');

      if (!allowedTags.has(node.tagName)) {
        const frag = document.createDocumentFragment();
        node.childNodes.forEach((ch) => frag.appendChild(clean(ch)));
        return frag;
      }

      const el = document.createElement(tag);

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
          if (!src || src.toLowerCase().startsWith('javascript:')) continue;
          // NOTE: if an image src is "cid:....", stripCidUrls will remove it later
          el.setAttribute('src', src);
          continue;
        }

        el.setAttribute(name, value);
      }

      // Allow only hex color styles (very limited + safe)
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

  async function postWorker(endpoint, payload) {
    if (!endpoint) throw new Error('Endpoint not configured.');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (!res.ok) {
      throw new Error(data?.error || text || `HTTP ${res.status}`);
    }
    if (data && data.ok === false) {
      throw new Error(data.error || 'Worker returned ok:false');
    }
    return data;
  }

  function mountAdminControls({ item, endpoints, onAfterArchive, onAfterPinChange }) {
    if (!isAdmin()) return;

    const controlsHost = document.getElementById('news-admin-controls');
    if (!controlsHost) return;

    const archiveEndpoint = endpoints.archiveEndpoint;
    const pinEndpoint = endpoints.pinEndpoint;
    const unpinEndpoint = endpoints.unpinEndpoint;

    const pinned = !!item.pinned;

    controlsHost.innerHTML = `
      <div class="news-article-controls">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="news-pin-btn">${pinned ? 'Unpin' : 'Pin'} Announcement</button>
          <button type="button" class="news-archive-btn">Archive Announcement</button>
        </div>
        <div class="status" id="news-admin-status" style="margin-top:8px;"></div>
      </div>
    `;

    const status = controlsHost.querySelector('#news-admin-status');
    const pinBtn = controlsHost.querySelector('.news-pin-btn');
    const archiveBtn = controlsHost.querySelector('.news-archive-btn');

    const setAdminStatus = (msg) => { if (status) status.textContent = msg || ''; };

    pinBtn.addEventListener('click', async () => {
      try {
        if (pinned) {
          const ok = confirm('Unpin this announcement?');
          if (!ok) return;
          setAdminStatus('Unpinning…');
          await postWorker(unpinEndpoint, { id: item.id });
          setAdminStatus('Unpinned.');
          onAfterPinChange(false);
        } else {
          const ok = confirm('Pin this announcement to the top of the feed?');
          if (!ok) return;
          setAdminStatus('Pinning…');
          await postWorker(pinEndpoint, { id: item.id });
          setAdminStatus('Pinned.');
          onAfterPinChange(true);
        }
      } catch (e) {
        console.error(e);
        setAdminStatus(`Pin action failed: ${e.message || e}`);
      }
    });

    archiveBtn.addEventListener('click', async () => {
      try {
        const ok = confirm('Archive this announcement and remove it from the feed?');
        if (!ok) return;

        setAdminStatus('Archiving…');
        await postWorker(archiveEndpoint, { id: item.id });
        setAdminStatus('Archived. Returning to News…');
        onAfterArchive();
      } catch (e) {
        console.error(e);
        setAdminStatus(`Archive failed: ${e.message || e}`);
      }
    });
  }

  async function load() {
    const id = getIdFromQuery();
    if (!id) {
      setStatus('Missing article id.');
      return;
    }

    setStatus('Loading article…');

    try {
      // Load config first (for admin endpoints)
      const config = await readConfig();
      const endpoints = config?.newsSubmission || {};

      // Load news.json
      const res = await fetch('../../data/news/news.json');
      if (!res.ok) throw new Error('news.json fetch failed');
      const data = await res.json();

      const items = Array.isArray(data.items) ? data.items : [];
      const item = items.find((x) => String(x.id) === String(id));

      if (!item) {
        setStatus('Article not found.');
        return;
      }

      const dateStr = item.date ? new Date(item.date).toLocaleString() : '';
      const subject = item.subject || '(no subject)';
      const from = item.from || '';

      const html = item.htmlBody ? sanitizeNewsHtml(item.htmlBody) : '';
      const plain = item.plainBody || item.snippet || '';

      const safeHtml = stripCidUrls(html || '');

      // Render article
      host.innerHTML = `
        <header class="event-detail-header">
          <p class="event-detail-date">${escapeHtml(dateStr)}</p>
          <h1 class="event-detail-title">${escapeHtml(subject)}</h1>
          ${from ? `<p class="event-detail-location">${escapeHtml(from)}</p>` : ''}
        </header>

        <div id="news-admin-controls"></div>

        <div class="event-detail-body">
          ${safeHtml ? safeHtml : `<p>${escapeHtml(plain).replace(/\n/g, '<br>')}</p>`}
        </div>
      `;

      // Admin controls (pin/unpin + archive)
      mountAdminControls({
        item,
        endpoints: {
          archiveEndpoint: endpoints.archiveEndpoint,
          pinEndpoint: endpoints.pinEndpoint,
          unpinEndpoint: endpoints.unpinEndpoint
        },
        onAfterArchive: () => setTimeout(() => (window.location.href = '../'), 650),
        onAfterPinChange: (nowPinned) => {
          // Update the button label without a full reload
          item.pinned = nowPinned;
          mountAdminControls({
            item,
            endpoints: {
              archiveEndpoint: endpoints.archiveEndpoint,
              pinEndpoint: endpoints.pinEndpoint,
              unpinEndpoint: endpoints.unpinEndpoint
            },
            onAfterArchive: () => setTimeout(() => (window.location.href = '../'), 650),
            onAfterPinChange: () => {}
          });
        }
      });

      setStatus('');
    } catch (e) {
      console.error(e);
      setStatus('Error loading article.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
