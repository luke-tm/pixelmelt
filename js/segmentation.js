// segmentation.js

var Segmentation = (function() {
  var model = null;
  var loadPromise = null;
  var loadFailed = false;

  function loadModel(onProgress) {
    if (model) return Promise.resolve(model);
    // Reset failure state on each explicit call so retries work
    if (loadFailed) {
      loadFailed = false;
      loadPromise = null;
    }
    if (loadPromise) return loadPromise;

    loadPromise = (function() {
      if (typeof bodyPix === 'undefined') {
        loadFailed = true;
        loadPromise = null;
        return Promise.reject(new Error('BodyPix library not loaded. Check your internet connection.'));
      }
      if (onProgress) onProgress(0, 'Downloading AI model...');
      return bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      }).then(function(m) {
        model = m;
        if (onProgress) onProgress(100, 'AI model ready!');
        return model;
      }).catch(function(err) {
        loadFailed = true;
        loadPromise = null;
        throw err;
      });
    })();

    return loadPromise;
  }

  function segmentPerson(imageSource, onProgress) {
    if (!model) return Promise.reject(new Error('Model not loaded'));
    if (onProgress) onProgress(5, 'Analyzing image...');

    return model.segmentPersonParts(imageSource, {
      flipHorizontal: false,
      internalResolution: 'high',
      segmentationThreshold: 0.4,
      maxDetections: 10,
      scoreThreshold: 0.3,
      nmsRadius: 20
    }).then(function(segmentation) {
      if (onProgress) onProgress(90, 'Person detected!');

      var width = segmentation.width;
      var height = segmentation.height;
      var data = segmentation.data;

      // Binary mask: 1 = person, 0 = background
      var mask = new Uint8Array(width * height);
      for (var i = 0; i < data.length; i++) {
        mask[i] = data[i] >= 0 ? 1 : 0;
      }

      // Keep raw part data for feature-level bias (part IDs 0-23, -1=background)
      // BodyPix face parts: 0=leftFace, 1=rightFace
      // Eye/brow parts: 2=leftUpperArmFront... actually face=0,1; torso=12,13 etc.
      // We'll use the full Int32Array — app.js will read it to build bias
      var partData = new Int32Array(data);

      // Extract face bounding box from pose keypoints
      var faceBounds = null;
      try {
        if (segmentation.allPoses && segmentation.allPoses.length > 0) {
          var FACE_KP = ['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar'];
          var pts = segmentation.allPoses[0].keypoints
            .filter(function(kp) { return FACE_KP.indexOf(kp.part) >= 0 && kp.score > 0.3; })
            .map(function(kp) { return kp.position; });
          if (pts.length >= 2) {
            var xs = pts.map(function(p) { return p.x; });
            var ys = pts.map(function(p) { return p.y; });
            var minX = Math.min.apply(null, xs);
            var maxX = Math.max.apply(null, xs);
            var minY = Math.min.apply(null, ys);
            var maxY = Math.max.apply(null, ys);
            var faceW = maxX - minX;
            var pad = faceW * 0.5;
            faceBounds = {
              x: Math.max(0, minX - pad),
              y: Math.max(0, minY - pad * 1.5),
              w: faceW + pad * 2,
              h: (maxY - minY) + pad * 3
            };
          }
        }
      } catch(e) { /* keypoints unavailable */ }

      return { mask: mask, partData: partData, width: width, height: height, faceBounds: faceBounds };
    });
  }

  function isLoaded() { return model !== null; }
  function hasFailed() { return loadFailed; }
  function reset() { model = null; loadPromise = null; loadFailed = false; }

  return { loadModel: loadModel, segmentPerson: segmentPerson, isLoaded: isLoaded, hasFailed: hasFailed, reset: reset };
})();
