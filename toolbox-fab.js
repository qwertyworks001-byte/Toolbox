// Toolbox floating "Recommend a tool" button (bottom-left). Add this to any page with:
//   <script src="toolbox-fab.js"></script>        (homepage)
//   <script src="../toolbox-fab.js"></script>     (tool pages)
(function () {
  if (/recommendation-tool\.html$/.test(location.pathname)) return;
  const me = document.currentScript;
  const base = me && me.src ? me.src.replace(/[^/]*$/, '') : '';
  function add() {
    if (document.getElementById('toolbox-fab')) return;
    const a = document.createElement('a');
    a.id = 'toolbox-fab'; a.href = base + 'RecommendationTool/recommendation-tool.html';
    a.title = 'Recommend a tool'; a.setAttribute('aria-label', 'Recommend a tool'); a.textContent = '\uD83D\uDCAC';
    a.style.cssText = 'position:fixed;left:1rem;bottom:1rem;z-index:9998;width:3rem;height:3rem;display:flex;align-items:center;justify-content:center;font-size:1.4rem;border-radius:999px;text-decoration:none;background:rgba(15,23,42,0.92);border:1px solid #475569;box-shadow:0 4px 14px rgba(0,0,0,0.4);transition:transform 0.15s ease,border-color 0.15s ease;';
    a.onmouseenter = () => { a.style.transform = 'scale(1.1)'; a.style.borderColor = '#3b82f6'; };
    a.onmouseleave = () => { a.style.transform = ''; a.style.borderColor = '#475569'; };
    document.body.appendChild(a);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();