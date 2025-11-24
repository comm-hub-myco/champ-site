window.LinksGrid = (() => {
  return {
    render(selector, config = {}) {
      const host = document.querySelector(selector);
      if (!host) return;

      host.innerHTML = `
        <ul class="links-list">
          <li><span class="muted">Add important links here (Discord, docs, resource sheets, etc.).</span></li>
        </ul>
      `;
    }
  };
})();
