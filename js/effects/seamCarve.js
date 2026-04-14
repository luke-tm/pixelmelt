// seamCarve.js

function computeEnergyMap(data, width, height, protectionMask, faceBias) {
  var energy = new Float32Array(width * height);
  var PROTECT = 1e8;

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var idx = y * width + x;

      if (protectionMask && protectionMask[idx] === 1) {
        energy[idx] = PROTECT;
        continue;
      }

      var xl = Math.max(0, x - 1), xr = Math.min(width - 1, x + 1);
      var yt = Math.max(0, y - 1), yb = Math.min(height - 1, y + 1);

      var iL = (y * width + xl) * 4, iR = (y * width + xr) * 4;
      var iT = (yt * width + x) * 4, iB = (yb * width + x) * 4;

      var dRx = data[iR]   - data[iL],   dGx = data[iR+1] - data[iL+1], dBx = data[iR+2] - data[iL+2];
      var dRy = data[iB]   - data[iT],   dGy = data[iB+1] - data[iT+1], dBy = data[iB+2] - data[iT+2];

      var e = Math.sqrt(dRx*dRx + dGx*dGx + dBx*dBx + dRy*dRy + dGy*dGy + dBy*dBy);
      if (faceBias) e *= faceBias[idx];
      energy[idx] = e;
    }
  }
  return energy;
}

function findVerticalSeam(energy, width, height) {
  var dp = new Float32Array(width * height);
  for (var x = 0; x < width; x++) dp[x] = energy[x];
  for (var y = 1; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var top = dp[(y-1)*width + x];
      if (x > 0)         top = Math.min(top, dp[(y-1)*width + x - 1]);
      if (x < width - 1) top = Math.min(top, dp[(y-1)*width + x + 1]);
      dp[y*width + x] = energy[y*width + x] + top;
    }
  }
  var seam = new Int32Array(height);
  var minVal = Infinity, minX = 0;
  var base = (height-1)*width;
  for (var x = 0; x < width; x++) { if (dp[base+x] < minVal) { minVal = dp[base+x]; minX = x; } }
  seam[height-1] = minX;
  for (var y = height-2; y >= 0; y--) {
    var px = seam[y+1], best = px, bestVal = dp[y*width+px];
    if (px > 0 && dp[y*width+px-1] < bestVal) { bestVal = dp[y*width+px-1]; best = px-1; }
    if (px < width-1 && dp[y*width+px+1] < bestVal) { best = px+1; }
    seam[y] = best;
  }
  return seam;
}

function findHorizontalSeam(energy, width, height) {
  var dp = new Float32Array(width * height);
  for (var y = 0; y < height; y++) dp[y*width] = energy[y*width];
  for (var x = 1; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var left = dp[y*width + x - 1];
      if (y > 0)          left = Math.min(left, dp[(y-1)*width + x - 1]);
      if (y < height - 1) left = Math.min(left, dp[(y+1)*width + x - 1]);
      dp[y*width + x] = energy[y*width + x] + left;
    }
  }
  var seam = new Int32Array(width);
  var minVal = Infinity, minY = 0;
  for (var y = 0; y < height; y++) { if (dp[y*width+width-1] < minVal) { minVal = dp[y*width+width-1]; minY = y; } }
  seam[width-1] = minY;
  for (var x = width-2; x >= 0; x--) {
    var py = seam[x+1], best = py, bestVal = dp[py*width+x];
    if (py > 0 && dp[(py-1)*width+x] < bestVal) { bestVal = dp[(py-1)*width+x]; best = py-1; }
    if (py < height-1 && dp[(py+1)*width+x] < bestVal) { best = py+1; }
    seam[x] = best;
  }
  return seam;
}

function removeVerticalSeam(data, seam, width, height) {
  var nw = width - 1, out = new Uint8ClampedArray(nw * height * 4);
  for (var y = 0; y < height; y++) {
    var dx = 0;
    for (var x = 0; x < width; x++) {
      if (x === seam[y]) continue;
      var s = (y*width+x)*4, d = (y*nw+dx)*4;
      out[d]=data[s]; out[d+1]=data[s+1]; out[d+2]=data[s+2]; out[d+3]=data[s+3];
      dx++;
    }
  }
  return out;
}

function removeHorizontalSeam(data, seam, width, height) {
  var nh = height - 1, out = new Uint8ClampedArray(width * nh * 4);
  for (var x = 0; x < width; x++) {
    var dy = 0;
    for (var y = 0; y < height; y++) {
      if (y === seam[x]) continue;
      var s = (y*width+x)*4, d = (dy*width+x)*4;
      out[d]=data[s]; out[d+1]=data[s+1]; out[d+2]=data[s+2]; out[d+3]=data[s+3];
      dy++;
    }
  }
  return out;
}

function removeVerticalSeamFromMask(mask, seam, width, height) {
  var nw = width - 1, out = new Uint8Array(nw * height);
  for (var y = 0; y < height; y++) {
    var dx = 0;
    for (var x = 0; x < width; x++) {
      if (x === seam[y]) continue;
      out[y*nw+dx] = mask[y*width+x]; dx++;
    }
  }
  return out;
}

function removeHorizontalSeamFromMask(mask, seam, width, height) {
  var nh = height - 1, out = new Uint8Array(width * nh);
  for (var x = 0; x < width; x++) {
    var dy = 0;
    for (var y = 0; y < height; y++) {
      if (y === seam[x]) continue;
      out[dy*width+x] = mask[y*width+x]; dy++;
    }
  }
  return out;
}

function removeVerticalSeamFromBias(bias, seam, width, height) {
  var nw = width - 1, out = new Float32Array(nw * height);
  for (var y = 0; y < height; y++) {
    var dx = 0;
    for (var x = 0; x < width; x++) {
      if (x === seam[y]) continue;
      out[y*nw+dx] = bias[y*width+x]; dx++;
    }
  }
  return out;
}

function removeHorizontalSeamFromBias(bias, seam, width, height) {
  var nh = height - 1, out = new Float32Array(width * nh);
  for (var x = 0; x < width; x++) {
    var dy = 0;
    for (var y = 0; y < height; y++) {
      if (y === seam[x]) continue;
      out[dy*width+x] = bias[y*width+x]; dy++;
    }
  }
  return out;
}

function seamCarve(canvas, protectionMask, options, onProgress, cancelToken) {
  var direction = options.direction || 'horizontal';
  var intensity  = options.intensity  || 0.3;
  var faceBias   = options.faceBias   || null;

  var origW = canvas.width, origH = canvas.height;
  var pixelData = canvas.getContext('2d').getImageData(0, 0, origW, origH).data;
  var currentW = origW, currentH = origH;
  var currentMask = protectionMask ? new Uint8Array(protectionMask) : null;
  var currentBias = faceBias ? new Float32Array(faceBias) : null;

  var vSeams = (direction === 'vertical' || direction === 'both') ? Math.floor(origW * intensity) : 0;
  var hSeams = (direction === 'horizontal' || direction === 'both') ? Math.floor(origH * intensity) : 0;
  var total = vSeams + hSeams;
  if (total === 0) return Promise.resolve(new ImageData(pixelData, currentW, currentH));

  var removed = 0;
  var YIELD = 5;
  function yieldUI() { return new Promise(function(r) { setTimeout(r, 0); }); }
  function progress(msg) {
    var pct = Math.round(removed / total * 100);
    if (onProgress) onProgress(pct, msg || ('Crunching... ' + removed + '/' + total));
  }

  function runVertical(i) {
    if (i >= vSeams) return Promise.resolve();
    if (cancelToken && cancelToken.cancelled) return Promise.resolve();
    var energy = computeEnergyMap(pixelData, currentW, currentH, currentMask, currentBias);
    var seam = findVerticalSeam(energy, currentW, currentH);
    pixelData = removeVerticalSeam(pixelData, seam, currentW, currentH);
    if (currentMask) currentMask = removeVerticalSeamFromMask(currentMask, seam, currentW, currentH);
    if (currentBias) currentBias = removeVerticalSeamFromBias(currentBias, seam, currentW, currentH);
    currentW--; removed++;
    if (i % YIELD === 0) { progress('Squeezing width... ' + removed + '/' + total); return yieldUI().then(function() { return runVertical(i+1); }); }
    return runVertical(i+1);
  }

  function runHorizontal(i) {
    if (i >= hSeams) return Promise.resolve();
    if (cancelToken && cancelToken.cancelled) return Promise.resolve();
    var energy = computeEnergyMap(pixelData, currentW, currentH, currentMask, currentBias);
    var seam = findHorizontalSeam(energy, currentW, currentH);
    pixelData = removeHorizontalSeam(pixelData, seam, currentW, currentH);
    if (currentMask) currentMask = removeHorizontalSeamFromMask(currentMask, seam, currentW, currentH);
    if (currentBias) currentBias = removeHorizontalSeamFromBias(currentBias, seam, currentW, currentH);
    currentH--; removed++;
    if (i % YIELD === 0) { progress('Squeezing height... ' + removed + '/' + total); return yieldUI().then(function() { return runHorizontal(i+1); }); }
    return runHorizontal(i+1);
  }

  return runVertical(0).then(function() {
    return runHorizontal(0);
  }).then(function() {
    progress('Done!');
    return new ImageData(pixelData, currentW, currentH);
  });
}

// Register
EffectRegistry.registerEffect('seamcarve', {
  name: 'Content-Aware Scale',
  description: 'Seam carving — squishes face and body',
  icon: '🌀',
  defaultOptions: { direction: 'horizontal', intensity: 0.3 },
  process: function(canvas, protectionMask, options, onProgress, cancelToken) {
    return seamCarve(canvas, protectionMask, options, onProgress, cancelToken);
  }
});
