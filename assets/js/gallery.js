(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const grid = document.getElementById('gallery-grid');
  const statusEl = document.getElementById('gallery-status');
  if (!grid) return;

  function isHeicLike(item) {
    const mime = (item.mime || '').toLowerCase();
    const raw = (item.image || '').toLowerCase();

    return (
      mime.includes('heic') ||
      mime.includes('heif') ||
      raw.endsWith('.heic') ||
      raw.endsWith('.heif')
    );
  }

  function resolveImageSrc(rawImage) {
    let src = rawImage || '';

    // If image path is absolute (starts with http), leave it
    if (/^https?:\/\//.test(src)) return src;

    // If it starts with 'gallery/', we only need '../' from /gallery/index.html
    if (src.startsWith('gallery/')) return `../${src}`;

    // If it starts with 'images/', it's already relative to /gallery/
    if (src.startsWith('images/')) return src;

    // Otherwise, treat it as a filename under /gallery/images/
    if (src) return `images/${src}`;

    return '';
  }

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

        const rawImage = item.image || '';
        const src = resolveImageSrc(rawImage);

        // HEIC/HEIF placeholder (many browsers cannot render HEIC in <img>)
        if (src && isHeicLike(item)) {
          const placeholder = document.createElement('div');
          placeholder.className = 'gallery-heic-placeholder';

          // Optional: show file name at end
          const fileName =
            rawImage && rawImage.includes('/')
              ? rawImage.split('/').pop()
              : rawImage;

          placeholder.innerHTML = `
            <div class="gallery-heic-icon">📸</div>
            <div class="gallery-heic-text">
              <div><strong>HEIC image</strong> (may not display in this browser)</div>
              <div style="margin-top:6px;">
                <a href="${src}" download>Download original</a>
              </div>
              ${fileName ? `<div class="gallery-heic-filename">${fileName}</div>` : ''}
            </div>
          `;

          imgWrap.appendChild(placeholder);
        } else {
          // Normal image (with fallback)
          const img = document.createElement('img');
          img.src = src;
          img.alt = item.alt || item.description || 'Fungal image';
          img.loading = 'lazy';

          img.addEventListener('error', () => {
            const fallback = document.createElement('div');
            fallback.className = 'gallery-image-error';
            fallback.textContent = 'Image could not be loaded.';
            img.replaceWith(fallback);
          });

          imgWrap.appendChild(img);
        }

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
