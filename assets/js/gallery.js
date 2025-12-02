(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const grid = document.getElementById('gallery-grid');
  const statusEl = document.getElementById('gallery-status');
  if (!grid) return;

  async function loadGallery() {
    try {
      statusEl.textContent = 'Loading gallery...';
      const res = await fetch('./index.json'); // gallery/index.json
      if (!res.ok) {
        statusEl.textContent = 'No gallery manifest found yet.';
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      // newest first
      items.sort((a, b) => {
        const da = a.date || a.added || '';
        const db = b.date || b.added || '';
        return db.localeCompare(da);
      });

      grid.innerHTML = '';
      if (!items.length) {
        statusEl.textContent = 'No images have been added yet.';
        return;
      }

      for (const item of items) {
        const card = document.createElement('article');
        card.className = 'gallery-item';

        const imgWrap = document.createElement('div');
        imgWrap.className = 'gallery-item-img-wrap';

        const img = document.createElement('img');
        img.src = `../${item.image}`; // e.g. gallery/images/xxx.jpg
        img.alt = item.alt || item.description || 'Fungal image';

        imgWrap.appendChild(img);

        const body = document.createElement('div');
        body.className = 'gallery-item-body';

        const meta = document.createElement('div');
        meta.className = 'gallery-item-meta';
        const date = item.date || '';
        const who = item.submitted_by || item.name || '';
        meta.textContent =
          [date, who ? `by ${who}` : ''].filter(Boolean).join(' · ');

        const desc = document.createElement('div');
        desc.className = 'gallery-item-desc';
        desc.textContent = item.description || '';

        const tags = document.createElement('div');
        tags.className = 'gallery-item-tags';
        if (item.tags && item.tags.length) {
          tags.textContent = item.tags.map((t) => `#${t}`).join(' ');
        }

        body.appendChild(meta);
        if (item.description) body.appendChild(desc);
        if (item.tags && item.tags.length) body.appendChild(tags);

        card.appendChild(imgWrap);
        card.appendChild(body);
        grid.appendChild(card);
      }

      statusEl.textContent = '';
    } catch (e) {
      console.error(e);
      statusEl.textContent =
        'Error loading gallery. Please try again later or contact the admins.';
    }
  }

  loadGallery();
})();
