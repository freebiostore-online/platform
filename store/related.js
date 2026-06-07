// Related Simulations — FreeBioStore
// Include at bottom of any demo page: <script src="/related.js"></script>
(function() {
  var ACCENT = '#10b981';
  var ITEM_PATH = '/items/';
  var REGISTRY_KEY = 'robots';

  function getCurrentId() {
    var path = window.location.pathname;
    var match = path.match(/\/items\/([^/]+)/);
    return match ? match[1] : null;
  }

  function render(current, items) {
    var same = items.filter(function(i) { return i.category === current.category && i.id !== current.id; });
    var others = items.filter(function(i) { return i.category !== current.category && i.id !== current.id; });
    var related = same.slice(0, 3);
    if (related.length < 3) related = related.concat(others.slice(0, 3 - related.length));
    if (related.length === 0) return;

    var container = document.createElement('div');
    container.id = 'related-sims';
    container.innerHTML = '<style>' +
      '#related-sims{position:fixed;bottom:0;left:0;right:0;z-index:50;background:#0a0a0a;border-top:1px solid #262626;padding:.6rem 1rem;display:flex;align-items:center;gap:.6rem;overflow-x:auto;transition:transform .3s}' +
      '#related-sims.hidden{transform:translateY(100%)}' +
      '.rel-label{font-size:.7rem;color:#737373;font-weight:600;white-space:nowrap;font-family:Manrope,system-ui,sans-serif}' +
      '.rel-card{display:flex;align-items:center;gap:.4rem;background:#141414;border:1px solid #262626;border-radius:8px;padding:.35rem .6rem;text-decoration:none;color:#fafafa;font-family:Manrope,system-ui,sans-serif;transition:border-color .15s;flex-shrink:0}' +
      '.rel-card:hover{border-color:' + ACCENT + '}' +
      '.rel-icon{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}' +
      '.rel-name{font-size:.72rem;font-weight:600;white-space:nowrap}' +
      '.rel-desc{font-size:.65rem;color:#737373;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rel-toggle{position:fixed;bottom:.4rem;right:.4rem;z-index:51;background:#141414;border:1px solid #262626;border-radius:6px;padding:.2rem .5rem;color:#737373;font-size:.65rem;cursor:pointer;font-family:Manrope,system-ui,sans-serif;transition:opacity .3s}' +
      '</style>' +
      '<span class="rel-label">Related:</span>' +
      related.map(function(r) {
        return '<a class="rel-card" href="' + ITEM_PATH + r.id + '/">' +
          '<div class="rel-icon" style="background:' + (r.iconBg || ACCENT) + '">' + (r.icon || '') + '</div>' +
          '<div><div class="rel-name">' + r.name + '</div>' +
          '<div class="rel-desc">' + (r.description || '') + '</div></div></a>';
      }).join('');

    document.body.appendChild(container);

    var toggle = document.createElement('button');
    toggle.className = 'rel-toggle';
    toggle.textContent = 'Hide related';
    toggle.addEventListener('click', function() {
      var hidden = container.classList.toggle('hidden');
      toggle.textContent = hidden ? 'Show related' : 'Hide related';
    });
    document.body.appendChild(toggle);
  }

  var currentId = getCurrentId();
  if (!currentId) return;

  fetch('/registry.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var items = data[REGISTRY_KEY] || [];
      var current = items.find(function(i) { return i.id === currentId; });
      if (current) render(current, items);
    })
    .catch(function() {});
})();
