window.LinksGrid = (() => {

  async function loadJSON(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadText(path) {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  }

  function parseLinkText(txt) {
    const link = {};
    txt.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.+)$/);
      if (m) link[m[1].toLowerCase()] = m[2].trim();
    });
    link.title = link.title || 'Untitled Link';
    link.url = link.url || '#';
    return link;
  }

  async function loadLinks(basePath) {
    const base = basePath || '.';
    let manifest;
    try {
      manifest = await loadJSON(`${base}/pages/dashboard/links/index.json`);
    } catch (e) {
      console.warn('[LinksGrid] Could not load links manifest:', e);
      return [];
    }

    const files = Array.isArray(manifest.links) ? manifest.links : [];
    const links = [];

    for (const fname of files) {
      const path = `${base}/pages/dashboard/links/items/${fname}`;
      try {
        const txt = await loadText(path);
        const link = parseLinkText(txt);
        link._file = fname;
        links.push(link);
      } catch (e) {
        console.warn('[LinksGrid] Failed loading link file:', path, e);
      }
    }

    // Optional: sort alphabetically by title
    links.sort((a, b) => a.title.localeCompare(b.title));
    return links;
  }

  function renderLinkCard(link) {
    const li = document.createElement('a');
    li.className = 'link-card';
    li.href = link.url;
    li.target = '_blank';
    li.rel = 'noopener';

    const title = document.createElement('div');
    title.className = 'link-card-title';
    title.textContent = link.title;

    const meta = document.createElement('div');
    meta.className = 'link-card-meta';
    meta.textContent = link.category || '';

    const desc = document.createElement('div');
    desc.className = 'link-card-desc';
    desc.textContent = link.description || '';

    li.appendChild(title);
    if (meta.textContent) li.appendChild(meta);
    if (desc.textContent) li.appendChild(desc);

    return li;
  }

  return {
    async render(selector, config = {}) {
      const host = document.querySelector(selector);
      if (!host) return;

      const basePath = config.basePath || '.';
      const links = await loadLinks(basePath);

      if (!links.length) {
        host.innerHTML = '<div class="muted">No links added yet.</div>';
        return;
      }

      // Clear and render list
      host.innerHTML = '';
      const list = document.createElement('div');
      list.className = 'links-grid';
      links.forEach(link => list.appendChild(renderLinkCard(link)));
      host.appendChild(list);
    }
  };
})();
