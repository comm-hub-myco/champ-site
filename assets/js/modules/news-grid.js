(function () {
  function initNews() {
    const container = document.getElementById('news-grid');
    const statusEl = document.getElementById('news-status');

    if (!container) {
      console.warn('[CHAMP news] #news-grid not found in DOM yet.');
      return false;
    }

    function setStatus(msg) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
    }

    function wordsSlice(text, maxWords) {
      const words = String(text || '').trim().split(/\s+/).filter(Boolean);
      if (words.length <= maxWords) return { text: words.join(' '), truncated: false };
      return { text: words.slice(0, maxWords).join(' '), truncated: true };
    }

    function htmlToText(html) {
      if (!html) return '';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body && doc.body.textContent) ? doc.body.textContent : '';
    }

    // Basic linkify for URLs + emails, returns safe-ish HTML
    function linkify(text) {
      const escaped = escapeHtml(text);

      // URLs (http/https)
      const urlRegex = /\bhttps?:\/\/[^\s<]+/gi;
      // Emails
      const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

      let out = escaped.replace(urlRegex, (m) => {
        return `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`;
      });

      out = out.replace(emailRegex, (m) => {
        return `<a href="mailto:${m}">${m}</a>`;
      });

      return out;
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function articleHref(id) {
      // Frontpage is at repo root; article page is /news/article/index.html?id=...
      return `news/article/?id=${encodeURIComponent(id)}`;
    }

    async function loadNews() {
      try {
        setStatus('Loading news...');
        const res = await fetch('data/news/news.json');

        if (!res.ok) {
          console.warn('[CHAMP news] news.json fetch failed:', res.status);
          setStatus('No news feed available yet.');
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];

        if (!items.length) {
          setStatus('No news items yet.');
          return;
        }

        // Sort newest first
        out.sort((a, b) => {
          const ap = a.pinned ? 1 : 0;
          const bp = b.pinned ? 1 : 0;
          if (bp !== ap) return bp - ap; // pinned first
          return (b.date || "").localeCompare(a.date || "");
        });

        container.innerHTML = '';

        items.slice(0, 10).forEach((item) => {
          const id = item.id || '';
          const href = articleHref(id);

          // Build preview text from HTML if available, else plain
          const sourceText =
            item.plainBody ||
            (item.htmlBody ? htmlToText(item.htmlBody) : '') ||
            item.snippet ||
            '';


          const collapsed = wordsSlice(sourceText, 20);
          const expanded = wordsSlice(sourceText, 150);

          const card = document.createElement('a');
          card.className = 'event-card'; // reuse event card styling
          card.href = href;

          const thumb = document.createElement('div');
          thumb.className = 'event-card-thumb';
          thumb.innerHTML = '<span>📰</span>';

          const body = document.createElement('div');
          body.className = 'event-card-body';

          const topRow = document.createElement('div');
          topRow.style.display = 'flex';
          topRow.style.alignItems = 'center';
          topRow.style.justifyContent = 'space-between';
          topRow.style.gap = '10px';

          const dateEl = document.createElement('div');
          dateEl.className = 'event-card-date';
          dateEl.textContent = item.date
            ? new Date(item.date).toLocaleString()
            : '';

          // Expand toggle (prevents navigation)
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'news-toggle';
          toggleBtn.textContent = 'Expand';
          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const expandedNow = card.classList.toggle('expanded');
            toggleBtn.textContent = expandedNow ? 'Collapse' : 'Expand';
            renderPreview(expandedNow);
          });

          topRow.appendChild(dateEl);
          topRow.appendChild(toggleBtn);

          const titleEl = document.createElement('h3');
          titleEl.className = 'event-card-title';
          titleEl.textContent = item.subject || '(no subject)';

          const metaEl = document.createElement('div');
          metaEl.className = 'event-card-meta';
          metaEl.textContent = item.from || '';

          const previewEl = document.createElement('div');
          previewEl.className = 'event-card-meta';

          function renderPreview(isExpanded) {
            if (!isExpanded) {
              // 150 words max, linkify
              previewEl.innerHTML = linkify(collapsed.text + (collapsed.truncated ? '…' : ''));
              return;
            }

            // 500 words max + “…Read More” link
            const base = expanded.text + (expanded.truncated ? '…' : '');
            const readMore = ` <a href="${href}">…Read More</a>`;
            previewEl.innerHTML = linkify(base) + readMore;

            // Ensure clicking links inside preview doesn’t toggle/navigate unexpectedly
            previewEl.querySelectorAll('a').forEach((a) => {
              a.addEventListener('click', (e) => {
                // allow navigation, but stop card click side-effects
                e.stopPropagation();
              });
            });
          }

          // Default: collapsed
          renderPreview(false);

          body.appendChild(topRow);
          body.appendChild(titleEl);
          if (item.from) body.appendChild(metaEl);
          body.appendChild(previewEl);

          card.appendChild(thumb);
          card.appendChild(body);
          container.appendChild(card);
        });

        setStatus('');
      } catch (err) {
        console.error('[CHAMP news] Error loading news:', err);
        setStatus('Error loading news. Please try again later.');
      }
    }

    loadNews();
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ok = initNews();
    if (ok) return;

    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (initNews() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 300);
  });
})();
