// gallery.js

var Gallery = (function() {
  var KEY = 'pixelmelt_gallery';
  var MAX = 50;
  var THUMB = 200;

  function saveToGallery(canvas, username) {
    try {
      var thumb = document.createElement('canvas');
      var scale = Math.min(1, THUMB / Math.max(canvas.width, canvas.height));
      thumb.width = Math.round(canvas.width * scale);
      thumb.height = Math.round(canvas.height * scale);
      thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
      var dataURL = thumb.toDataURL('image/png');
      var entry = {
        id: Date.now() + Math.random().toString(36).slice(2),
        dataURL: dataURL,
        username: username ? username.slice(0,20) : 'Anonymous',
        timestamp: Date.now()
      };
      var gallery = loadGallery();
      gallery.unshift(entry);
      if (gallery.length > MAX) gallery = gallery.slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(gallery));
      return true;
    } catch(e) { console.error('Gallery save error:', e); return false; }
  }

  function loadGallery() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; }
  }

  function clearGallery() {
    try { localStorage.removeItem(KEY); return true; } catch(e) { return false; }
  }

  function renderGallery(container) {
    var gallery = loadGallery();
    container.innerHTML = '';
    if (gallery.length === 0) {
      container.innerHTML = '<div class="gallery-empty">No creations yet!<br>Be the first to share! ✨</div>';
      return;
    }
    gallery.forEach(function(entry) {
      var item = document.createElement('div');
      item.className = 'gallery-item';
      var img = document.createElement('img');
      img.src = entry.dataURL;
      img.alt = 'Creation by ' + entry.username;
      img.loading = 'lazy';
      var caption = document.createElement('div');
      caption.className = 'gallery-item-caption';
      var d = new Date(entry.timestamp);
      caption.textContent = entry.username + ' — ' + (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
      item.appendChild(img);
      item.appendChild(caption);
      container.appendChild(item);
    });
  }

  function getCount() { return loadGallery().length; }

  return { saveToGallery: saveToGallery, loadGallery: loadGallery, clearGallery: clearGallery, renderGallery: renderGallery, getCount: getCount };
})();
