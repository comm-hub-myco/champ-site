(function () {
  localStorage.setItem('champ_admin', 'true'); // For testing only; remove in production

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const statusEl = document.getElementById('article-status');
  const host = document.getElementById('article');

  function getIdFromQuery() {
    const url = new URL(window.location.href);
    return url.searchParams.get('id') || '';
  }

  async function readConfig() {
    try {
      const res = await fetch('../../data/site-config.json');
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }

function isAdmin() {
  return localStorage.getItem('champ_admin') === 'false';
}


  // Allow basic formatting + links. Remove scripts/styles and dangerous attrs.
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

      // Drop script/style entirely
      if (tag === 'script' || tag === 'style') return document.createTextNode('');

      // If tag not allowed, flatten children
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
          if (!src || src.toLowerCase().startsWith('javascript:')) continue;
          el.setAttribute('src', src);
          continue;
        }

        el.setAttribute(name, value);
      }

      // Basic inline style support (optional): allow only color
      if (tag === 'span' || tag === 'div' || tag === 'p') {
        const style = node.getAttribute('style') || '';
        const m = style.match(/color\s*:\s*([^;]+)/i);
        if (m) {
          const val = m[1].trim();
          // Allow only hex colors (keeps things simple + safe)
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

  async function load() {
    const id = getIdFromQuery();
    if (!id) {
      if (statusEl) statusEl.textContent = 'Missing article id.';
      return;
    }

    // Add delete controls for admins only
    if (isAdmin()) {
      const config = await readConfig();
      const endpoint = config?.newsDeletion?.endpoint;

      const controls = document.createElement('div');
      controls.className = 'news-article-controls';
      controls.innerHTML = `
        <button type="button" class="news-delete-btn">Delete Announcement</button>
        <div class="status" style="margin-top:8px;" id="news-delete-status"></div>
      `;

      host.appendChild(controls);

      const btn = controls.querySelector('.news-delete-btn');
      const delStatus = controls.querySelector('#news-delete-status');

      btn.addEventListener('click', async () => {
        if (!endpoint) {
          delStatus.textContent = 'Delete endpoint is not configured.';
          return;
        }

        const ok = confirm('Delete this announcement from the CHAMP site? This can be undone only by removing it from deleted.json.');
        if (!ok) return;

        delStatus.textContent = 'Deleting…';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });

          if (!res.ok) {
            const text = await res.text();
            console.warn('Delete error:', res.status, text);
            delStatus.textContent = 'Delete failed. Please try again.';
            return;
          }

          const data = await res.json();
          if (!data.ok) {
            delStatus.textContent = data.error || 'Delete failed.';
            return;
          }

          delStatus.textContent = 'Deleted. Returning to News…';
          setTimeout(() => {
            window.location.href = '../';
          }, 700);
        } catch (e) {
          console.error(e);
          delStatus.textContent = 'Delete failed due to a network error.';
        }
      });
    }

    try {
      const res = await fetch('../../data/news/news.json');
      if (!res.ok) throw new Error('news.json fetch failed');
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const item = items.find((x) => String(x.id) === String(id));

      if (!item) {
        if (statusEl) statusEl.textContent = 'Article not found.';
        return;
      }

      const dateStr = item.date ? new Date(item.date).toLocaleString() : '';
      const subject = item.subject || '(no subject)';
      const from = item.from || '';

      const html = item.htmlBody ? sanitizeNewsHtml(item.htmlBody) : '';
      const plain = item.plainBody || item.snippet || '';

      host.innerHTML = `
        <header class="event-detail-header">
          <p class="event-detail-date">${dateStr}</p>
          <h1 class="event-detail-title">${escapeHtml(subject)}</h1>
          ${from ? `<p class="event-detail-location">${escapeHtml(from)}</p>` : ''}
        </header>

        <div class="event-detail-body">
          ${html ? html : `<p>${escapeHtml(plain).replace(/\n/g, '<br>')}</p>`}
        </div>
      `;
    } catch (e) {
      console.error(e);
      if (statusEl) statusEl.textContent = 'Error loading article.';
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', load);
})();
