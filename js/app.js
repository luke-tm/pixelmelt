// app.js — v3.0

(function() {
  'use strict';

  var sourceCanvas = null;
  var resultCanvas = null;
  var cancelToken = { cancelled: false };
  var isProcessing = false;
  var imageReady = false; // true only once loadImageToCanvas resolves

  var sections = {
    upload:  document.getElementById('section-upload'),
    loading: document.getElementById('section-loading'),
    result:  document.getElementById('section-result'),
    gallery: document.getElementById('section-gallery')
  };

  var el = {
    fileInputTap:       document.getElementById('file-input-tap'),
    fileInputBrowse:    document.getElementById('file-input-browse'),
    fileInputCamera:    document.getElementById('file-input-camera'),
    uploadArea:         document.getElementById('upload-area'),
    previewPanel:       document.getElementById('preview-panel'),
    previewCanvas:      document.getElementById('preview-canvas'),
    btnProcess:         document.getElementById('btn-process'),
    btnCancel:          document.getElementById('btn-cancel'),
    loadingTitle:       document.getElementById('loading-title'),
    progressBar:        document.getElementById('progress-bar'),
    progressText:       document.getElementById('progress-text'),
    loadingDetail:      document.getElementById('loading-detail'),
    resultCanvas:       document.getElementById('result-canvas'),
    resultStats:        document.getElementById('result-stats'),
    btnDownload:        document.getElementById('btn-download'),
    btnAdjust:          document.getElementById('btn-adjust'),
    btnShare:           document.getElementById('btn-share'),
    btnNew:             document.getElementById('btn-new'),
    shareForm:          document.getElementById('share-form'),
    shareUsername:      document.getElementById('share-username'),
    btnConfirmShare:    document.getElementById('btn-confirm-share'),
    btnCancelShare:     document.getElementById('btn-cancel-share'),
    galleryGrid:        document.getElementById('gallery-grid'),
    galleryCount:       document.getElementById('gallery-count'),
    btnClearGallery:    document.getElementById('btn-clear-gallery'),
    btnBackFromGallery: document.getElementById('btn-back-from-gallery'),
    btnGotoGallery:     document.getElementById('btn-goto-gallery'),
    intensitySlider:    document.getElementById('intensity-slider'),
    intensityDisplay:   document.getElementById('intensity-display'),
    visitorCounter:     document.getElementById('visitor-counter'),
    footerYear:         document.getElementById('footer-year')
  };

  // ---- Sections ----
  function showSection(name) {
    Object.keys(sections).forEach(function(k) {
      if (!sections[k]) return;
      if (k === name) {
        sections[k].style.display = 'block';
        sections[k].classList.add('active');
      } else {
        sections[k].style.display = 'none';
        sections[k].classList.remove('active');
      }
    });
  }

  function setProgress(pct, title, detail) {
    if (el.progressBar)   el.progressBar.style.width   = Math.min(100, pct) + '%';
    if (el.progressText)  el.progressText.textContent   = Math.round(pct) + '%';
    if (title  && el.loadingTitle)  el.loadingTitle.textContent  = title;
    if (detail && el.loadingDetail) el.loadingDetail.textContent = detail;
  }

  // ---- File upload ----
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    imageReady = false;
    sourceCanvas = null;
    resultCanvas = null;
    loadImageToCanvas(file, 800).then(function(result) {
      sourceCanvas = result.canvas;
      copyCanvasToDisplay(sourceCanvas, el.previewCanvas, 340);
      el.previewPanel.style.display = '';
      imageReady = true;
    }).catch(function() {
      alert('Could not load image. Please try another.');
    });
  }

  function attachFileInput(input) {
    if (!input) return;
    input.addEventListener('change', function(e) {
      var f = e.target.files && e.target.files[0];
      if (f) { handleFile(f); e.target.value = ''; }
    });
  }
  attachFileInput(el.fileInputTap);
  attachFileInput(el.fileInputBrowse);
  attachFileInput(el.fileInputCamera);

  el.uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); el.uploadArea.classList.add('drag-over'); });
  el.uploadArea.addEventListener('dragleave', function() { el.uploadArea.classList.remove('drag-over'); });
  el.uploadArea.addEventListener('drop', function(e) {
    e.preventDefault(); el.uploadArea.classList.remove('drag-over');
    var f = e.dataTransfer.files[0]; if (f) handleFile(f);
  });

  el.intensitySlider.addEventListener('input', function() {
    el.intensityDisplay.textContent = el.intensitySlider.value + '%';
  });

  // ---- Helpers ----
  function autocrop(canvas, padding) {
    var w = canvas.width, h = canvas.height;
    var data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var minX = w, maxX = 0, minY = h, maxY = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data[(y*w+x)*4+3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (minX >= maxX || minY >= maxY) return canvas;
    minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
    maxX = Math.min(w-1, maxX + padding); maxY = Math.min(h-1, maxY + padding);
    var out = document.createElement('canvas');
    out.width = maxX - minX + 1; out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function displayOnCheckerboard(src, dest, maxWidth) {
    var scale = Math.min(1, maxWidth / Math.max(src.width, src.height));
    dest.width  = Math.round(src.width  * scale);
    dest.height = Math.round(src.height * scale);
    var ctx = dest.getContext('2d');
    var sq = 12;
    for (var y = 0; y < dest.height; y += sq) {
      for (var x = 0; x < dest.width; x += sq) {
        ctx.fillStyle = ((x/sq + y/sq) % 2 === 0) ? '#CCCCCC' : '#FFFFFF';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    ctx.drawImage(src, 0, 0, dest.width, dest.height);
  }

  // ---- Process ----
  el.btnProcess.addEventListener('click', function() {
    if (isProcessing) return;
    if (!imageReady || !sourceCanvas) return; // silent guard — no alert

    isProcessing = true;
    cancelToken = { cancelled: false };
    var intensity = parseInt(el.intensitySlider.value, 10) / 100;

    showSection('loading');
    setProgress(0, 'Starting...', 'Warming up the AI...');

    setProgress(5, 'Loading AI model', 'First time only — ~10 seconds...');
    Segmentation.loadModel(function(pct, msg) {
      setProgress(5 + pct * 0.25, 'Loading AI model', msg);
    }).then(function() {
      if (cancelToken.cancelled) return Promise.reject('cancelled');
      setProgress(30, 'Preparing image...', 'Setting up for AI analysis...');
      var imgDataURL = sourceCanvas.toDataURL('image/jpeg', 0.92);
      var tempImg = new Image();
      return new Promise(function(res, rej) {
        tempImg.onload = function() { res(tempImg); };
        tempImg.onerror = rej;
        tempImg.src = imgDataURL;
      });

    }).then(function(tempImg) {
      if (cancelToken.cancelled) return Promise.reject('cancelled');
      setProgress(35, 'Detecting person...', 'AI is isolating the subject...');
      return Segmentation.segmentPerson(tempImg, function(pct, msg) {
        setProgress(35 + pct * 0.3, 'Detecting person...', msg);
      });

    }).then(function(segResult) {
      if (cancelToken.cancelled) return Promise.reject('cancelled');

      var origW = sourceCanvas.width, origH = sourceCanvas.height;
      var mask = segResult.mask;
      if (segResult.width !== origW || segResult.height !== origH) {
        mask = resizeMask(segResult.mask, segResult.width, segResult.height, origW, origH);
      }

      // Cut out person
      setProgress(67, 'Removing background...', 'Cutting out the subject...');
      var cutoutCanvas = document.createElement('canvas');
      cutoutCanvas.width = origW; cutoutCanvas.height = origH;
      var cutoutCtx = cutoutCanvas.getContext('2d');
      cutoutCtx.drawImage(sourceCanvas, 0, 0);
      var cutoutData = cutoutCtx.getImageData(0, 0, origW, origH);
      for (var i = 0; i < origW * origH; i++) {
        cutoutData.data[i*4+3] = mask[i] === 1 ? 255 : 0;
      }
      cutoutCtx.putImageData(cutoutData, 0, 0);
      var cropped = autocrop(cutoutCanvas, 8);
      if (cancelToken.cancelled) return Promise.reject('cancelled');

      var effect = EffectRegistry.getEffect('seamcarve');
      if (!effect) throw new Error('seamcarve effect not registered');

      var cw = cropped.width, ch = cropped.height;

      // ---- SPLIT ----
      // Top 30% = head/face. Bottom 70% = body.
      var splitY = Math.round(ch * 0.30);

      var faceStrip = document.createElement('canvas');
      faceStrip.width = cw; faceStrip.height = splitY;
      faceStrip.getContext('2d').drawImage(cropped, 0, 0, cw, splitY, 0, 0, cw, splitY);

      var bodyStrip = document.createElement('canvas');
      bodyStrip.width = cw; bodyStrip.height = ch - splitY;
      bodyStrip.getContext('2d').drawImage(cropped, 0, splitY, cw, ch - splitY, 0, 0, cw, ch - splitY);

      // ---- FACE BIAS MAP from keypoints ----
      // Build a simple bias map using only the faceBounds bbox — no pixel scanning.
      // Features zone (middle 25-80% of face bbox) gets low energy to attract seams.
      var faceBiasMap = null;
      var faceBounds = segResult.faceBounds;
      if (faceBounds && segResult.width > 0 && segResult.height > 0) {
        var sx = origW / segResult.width;
        var sy = origH / segResult.height;
        // Approximate crop offset as 0 (good enough — bias just attracts seams, doesn't need pixel-perfect coords)
        var kMinY = Math.max(0, (faceBounds.y * sy));
        var kMaxY = Math.min(splitY, ((faceBounds.y + faceBounds.h) * sy));
        var kMinX = Math.max(0, (faceBounds.x * sx));
        var kMaxX = Math.min(cw, ((faceBounds.x + faceBounds.w) * sx));

        var fzTop    = Math.round(kMinY + (kMaxY - kMinY) * 0.25);
        var fzBottom = Math.round(kMinY + (kMaxY - kMinY) * 0.80);
        var fzLeft   = Math.round(kMinX);
        var fzRight  = Math.round(kMaxX);

        if (fzBottom > fzTop && fzRight > fzLeft) {
          faceBiasMap = new Float32Array(cw * splitY).fill(1.0);
          for (var fy = fzTop; fy < fzBottom; fy++) {
            for (var fx = fzLeft; fx < fzRight; fx++) {
              if (fy >= 0 && fy < splitY && fx >= 0 && fx < cw) {
                faceBiasMap[fy * cw + fx] = 0.05;
              }
            }
          }
        }
      }

      setProgress(70, 'Warping subject...', 'Processing...');

      // Carve body at full intensity (horizontal = vertical squeeze)
      return effect.process(
        bodyStrip, null,
        { direction: 'horizontal', intensity: intensity },
        function(pct) { setProgress(70 + pct * 0.15, 'Warping body...', 'Squishing body...'); },
        cancelToken
      ).then(function(carvedBodyData) {
        if (cancelToken.cancelled) return Promise.reject('cancelled');

        // Carve face strip with bias map — single pass, no hard zone cuts
        // Use 'both' direction: horizontal seams compress face height,
        // vertical seams compress face width → features appear wider/buggier
        return effect.process(
          faceStrip, null,
          { direction: 'both', intensity: intensity * 0.7, faceBias: faceBiasMap },
          function(pct) { setProgress(85 + pct * 0.10, 'Warping face...', 'Distorting features...'); },
          cancelToken
        ).then(function(carvedFaceData) {
          if (cancelToken.cancelled) return Promise.reject('cancelled');

          var faceOut = document.createElement('canvas');
          putImageDataOnCanvas(faceOut, carvedFaceData);
          var bodyOut = document.createElement('canvas');
          putImageDataOnCanvas(bodyOut, carvedBodyData);

          // ---- COMPOSITE ----
          // Force face = 70% of final height, body = 30%
          var naturalTotal = faceOut.height + bodyOut.height;
          var tFace = Math.round(naturalTotal * 0.70);
          var tBody = naturalTotal - tFace;

          var final = document.createElement('canvas');
          final.width = cw;
          final.height = tFace + tBody;
          var fctx = final.getContext('2d');
          fctx.drawImage(faceOut, 0, 0, cw, tFace);
          fctx.drawImage(bodyOut, 0, tFace, cw, tBody);
          return final;
        });
      });

    }).then(function(finalCanvas) {
      if (!finalCanvas || cancelToken.cancelled) { isProcessing = false; showSection('upload'); return; }
      setProgress(99, 'Finishing up...', 'Almost there!');
      resultCanvas = finalCanvas;
      displayOnCheckerboard(resultCanvas, el.resultCanvas, 340);
      el.resultStats.textContent = 'Warped: ' + resultCanvas.width + 'x' + resultCanvas.height + 'px  |  Squeeze: ' + Math.round(intensity*100) + '%';
      setProgress(100, 'Done!', 'Your sticker is ready!');
      isProcessing = false;
      setTimeout(function() { showSection('result'); }, 300);

    }).catch(function(err) {
      isProcessing = false;
      if (err === 'cancelled') { showSection('upload'); return; }
      console.error('Processing error:', err);
      alert('Something went wrong:\n' + (err.message || err));
      showSection('upload');
    });
  });

  // ---- Cancel ----
  el.btnCancel.addEventListener('click', function() {
    cancelToken.cancelled = true;
    isProcessing = false;
    showSection('upload');
  });

  // ---- Download ----
  el.btnDownload.addEventListener('click', function() {
    if (!resultCanvas) return;
    canvasToBlob(resultCanvas, 'image/png').then(function(blob) {
      downloadBlob(blob, generateFilename('sticker') + '.png');
    }).catch(function(err) { alert('Download failed: ' + err.message); });
  });

  // ---- Adjust (go back to slider with same image) ----
  el.btnAdjust.addEventListener('click', function() {
    resultCanvas = null;
    el.shareForm.style.display = 'none';
    // Show the preview panel (image is still loaded)
    el.previewPanel.style.display = '';
    showSection('upload');
  });

  // ---- Share ----
  el.btnShare.addEventListener('click', function() { el.shareForm.style.display = ''; el.shareUsername.value = ''; el.shareUsername.focus(); });
  el.btnCancelShare.addEventListener('click', function() { el.shareForm.style.display = 'none'; });
  el.btnConfirmShare.addEventListener('click', function() {
    if (!resultCanvas) return;
    var ok = Gallery.saveToGallery(resultCanvas, el.shareUsername.value.trim() || 'Anonymous');
    el.shareForm.style.display = 'none';
    alert(ok ? 'Posted to the gallery!' : 'Could not save. Try clearing old entries.');
  });

  // ---- New photo ----
  el.btnNew.addEventListener('click', function() {
    sourceCanvas = null; resultCanvas = null;
    imageReady = false; isProcessing = false;
    el.previewPanel.style.display = 'none';
    el.shareForm.style.display = 'none';
    showSection('upload');
  });

  // ---- Gallery ----
  function refreshGallery() {
    Gallery.renderGallery(el.galleryGrid);
    var n = Gallery.getCount();
    el.galleryCount.textContent = n + (n === 1 ? ' creation shared' : ' creations shared');
  }
  el.btnGotoGallery.addEventListener('click', function() { refreshGallery(); showSection('gallery'); });
  el.btnBackFromGallery.addEventListener('click', function() { showSection('upload'); });
  el.btnClearGallery.addEventListener('click', function() {
    if (confirm('Clear all gallery entries?')) { Gallery.clearGallery(); refreshGallery(); }
  });

  // ---- Footer ----
  if (el.footerYear) el.footerYear.textContent = new Date().getFullYear();
  if (el.visitorCounter) {
    var v = parseInt(localStorage.getItem('pixelmelt_visits') || '0', 10) + 1;
    localStorage.setItem('pixelmelt_visits', v);
    el.visitorCounter.textContent = String(42317 + v).padStart(5, '0');
  }

  // ---- Init ----
  showSection('upload');

})();
