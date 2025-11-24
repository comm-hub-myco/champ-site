window.NewsGrid = (() => {
  return {
    render(selector, config = {}) {
      const host = document.querySelector(selector);
      if (!host) return;

      host.innerHTML = `
        <div class="muted">
          News feed coming soon.<br>
          (We’ll likely pull from your Proton thread JSON here.)
        </div>
      `;
    }
  };
})();
