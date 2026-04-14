// utils.js

function loadImageToCanvas(file, maxSize) {
  maxSize = maxSize || 800;
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ canvas: canvas, scaledWidth: w, scaledHeight: h });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function copyCanvasToDisplay(src, dest, maxWidth) {
  var scale = Math.min(1, maxWidth / Math.max(src.width, src.height));
  dest.width = Math.round(src.width * scale);
  dest.height = Math.round(src.height * scale);
  dest.getContext('2d').drawImage(src, 0, 0, dest.width, dest.height);
}

function putImageDataOnCanvas(canvas, imageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}

function canvasToBlob(canvas, type, quality) {
  type = type || 'image/png';
  quality = quality || 0.92;
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      if (blob) resolve(blob); else reject(new Error('toBlob failed'));
    }, type, quality);
  });
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function resizeMask(mask, origW, origH, newW, newH) {
  var out = new Uint8Array(newW * newH);
  var xr = origW / newW, yr = origH / newH;
  for (var y = 0; y < newH; y++) {
    for (var x = 0; x < newW; x++) {
      var sx = Math.min(Math.floor(x * xr), origW - 1);
      var sy = Math.min(Math.floor(y * yr), origH - 1);
      out[y * newW + x] = mask[sy * origW + sx];
    }
  }
  return out;
}

function generateFilename(prefix) {
  prefix = prefix || 'pixelmelt';
  var now = new Date();
  var ts = now.getFullYear() + '' +
    String(now.getMonth()+1).padStart(2,'0') +
    String(now.getDate()).padStart(2,'0') + '_' +
    String(now.getHours()).padStart(2,'0') +
    String(now.getMinutes()).padStart(2,'0');
  return prefix + '_' + ts;
}
