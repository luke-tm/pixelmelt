import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = `${import.meta.env.BASE_URL}models`;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/**
 * Detect the primary face + landmarks on a canvas element.
 * Tries three input sizes with a low score threshold so faces with
 * sunglasses or partial occlusion are still picked up.
 */
export async function detectFace(canvas) {
  for (const inputSize of [416, 512, 320]) {
    const opts = new faceapi.TinyFaceDetectorOptions({
      inputSize,
      scoreThreshold: 0.25,
    });
    const result = await faceapi
      .detectSingleFace(canvas, opts)
      .withFaceLandmarks(true);
    if (result) return result;
  }
  return null;
}

/**
 * Apply caricature in-place on `canvas`:
 *   1. Big-head: head region → 60 % of canvas height.
 *   2. Feature bulge: eyes and mouth magnified within the enlarged head.
 *
 * When no face is detected a position-based fallback is used for stage 1
 * (top ~33 % of the image treated as the head). Stage 2 is skipped.
 */
export function applyCaricature(canvas, detection) {
  bigHeadComposite(canvas, detection);
  if (detection) featureBulge(canvas, detection);
}

// ─── Stage 1: big-head composite ────────────────────────────────────────────

function bigHeadComposite(canvas, detection) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');

  let headTop, headBottom, headLeft, headRight;

  if (detection) {
    const { box } = detection;
    // Keep padding tight so headH ≈ actual head, not a large inflated region.
    // Previous values (padTop = 0.55×) made headH much larger than the true
    // head, which drove scale close to 1× and produced almost no enlargement.
    const padTop = box.height * 0.35; // forehead / hair
    const padBot = box.height * 0.08; // chin
    const padX   = box.width  * 0.18; // sides

    headTop    = Math.max(0,      box.y - padTop);
    headBottom = Math.min(height, box.y + box.height + padBot);
    headLeft   = Math.max(0,      box.x - padX);
    headRight  = Math.min(width,  box.x + box.width + padX);
  } else {
    // Fallback: no face detected — assume head occupies the top third.
    headTop    = 0;
    headBottom = Math.round(height * 0.33);
    headLeft   = 0;
    headRight  = width;
  }

  const headW = headRight - headLeft;
  const headH = headBottom - headTop;

  const targetHeadH = height * 0.60;
  // Always scale UP. Even if the detector over-estimates headH we never
  // shrink below 1.8× so the big-head effect is always visible.
  const scale   = Math.max(1.8, targetHeadH / headH);
  const scaledW = headW * scale;

  const destHeadX = (width - scaledW) / 2; // may be negative — that's fine, canvas clips
  const destBodyY = targetHeadH;
  const srcBodyH  = height - headBottom;
  const dstBodyH  = height - destBodyY;

  const out    = document.createElement('canvas');
  out.width    = width;
  out.height   = height;
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';

  // Body — everything below the head, compressed into the bottom 40 %
  if (srcBodyH > 0 && dstBodyH > 0) {
    outCtx.drawImage(
      canvas,
      0, headBottom, width, srcBodyH,
      0, destBodyY,  width, dstBodyH,
    );
  }

  // Head — scaled up, centred horizontally
  outCtx.drawImage(
    canvas,
    headLeft, headTop, headW,    headH,
    destHeadX, 0,      scaledW, targetHeadH,
  );

  // Persist mapping so featureBulge can remap landmarks into new head-space
  canvas._headMap = { headLeft, headTop, headW, headH, scaledW, targetHeadH, destHeadX };

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(out, 0, 0);
}

// ─── Stage 2: eye & mouth bulge magnification ────────────────────────────────

function featureBulge(canvas, detection) {
  const map = canvas._headMap;
  const lm  = detection.landmarks;

  // Remap a landmark from original-image space into the scaled head-space
  function remap(p) {
    const relX = (p.x - map.headLeft) / map.headW;
    const relY = (p.y - map.headTop)  / map.headH;
    return {
      x: map.destHeadX + relX * map.scaledW,
      y: relY * map.targetHeadH,
    };
  }

  function featureDesc(points, radiusMult, strength) {
    const remapped = points.map(remap);
    const cx = remapped.reduce((s, p) => s + p.x, 0) / remapped.length;
    const cy = remapped.reduce((s, p) => s + p.y, 0) / remapped.length;
    const baseR = Math.max(...remapped.map(p => Math.hypot(p.x - cx, p.y - cy)));
    return { cx, cy, radius: baseR * radiusMult, strength };
  }

  const features = [
    featureDesc(lm.getLeftEye(),  5.5, 0.74),
    featureDesc(lm.getRightEye(), 5.5, 0.74),
    featureDesc(lm.getMouth(),    4.2, 0.70),
  ];

  applyBulge(canvas, features);
}

// ─── Radial bulge distortion ──────────────────────────────────────────────────

function applyBulge(canvas, features) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, width, height);
  const dst = new ImageData(width, height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let sx = px;
      let sy = py;

      for (const { cx, cy, radius, strength } of features) {
        const dx   = px - cx;
        const dy   = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > 0) {
          const t      = dist / radius;
          const factor = 1 - strength * (1 - t * t);
          sx = cx + dx * factor;
          sy = cy + dy * factor;
        }
      }

      bilinearSample(src.data, dst.data, px, py, sx, sy, width, height);
    }
  }

  ctx.putImageData(dst, 0, 0);
}

function bilinearSample(src, dst, dx, dy, sx, sy, width, height) {
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, width  - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx  = sx - x0;
  const fy  = sy - y0;
  const di  = (dy * width + dx) * 4;

  for (let c = 0; c < 4; c++) {
    const tl = src[(y0 * width + x0) * 4 + c];
    const tr = src[(y0 * width + x1) * 4 + c];
    const bl = src[(y1 * width + x0) * 4 + c];
    const br = src[(y1 * width + x1) * 4 + c];
    dst[di + c] = Math.round(
      tl * (1 - fx) * (1 - fy) +
      tr *      fx  * (1 - fy) +
      bl * (1 - fx) *      fy  +
      br *      fx  *      fy,
    );
  }
}
