import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  // BASE_URL is '/pixelmelt/' on GitHub Pages, '/' in dev
  const MODEL_URL = `${import.meta.env.BASE_URL}models`;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/**
 * Detect the primary face + landmarks on a canvas element.
 * Returns the detection result, or null if no face is found.
 */
export async function detectFace(canvas) {
  const opts = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.4,
  });
  const result = await faceapi
    .detectSingleFace(canvas, opts)
    .withFaceLandmarks(true);
  return result ?? null;
}

/**
 * Apply a two-stage caricature effect in-place on `canvas`:
 *   1. Big-head: scale the head region to ~60 % of the canvas height.
 *   2. Feature bulge: magnify eyes and mouth in the enlarged head.
 *
 * If detection is null the canvas is returned unchanged.
 */
export function applyCaricature(canvas, detection) {
  if (!detection) return;

  bigHeadComposite(canvas, detection);
  featureBulge(canvas, detection);
}

// ─── Stage 1: big-head composite ────────────────────────────────────────────

function bigHeadComposite(canvas, detection) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const { box } = detection;

  // Pad the raw face box to include forehead, hair and chin
  const padX    = box.width  * 0.30;
  const padTop  = box.height * 0.55;   // generous top for hair
  const padBot  = box.height * 0.20;

  const headTop    = Math.max(0, box.y - padTop);
  const headBottom = Math.min(height, box.y + box.height + padBot);
  const headLeft   = Math.max(0, box.x - padX);
  const headRight  = Math.min(width,  box.x + box.width  + padX);
  const headW      = headRight - headLeft;
  const headH      = headBottom - headTop;

  const TARGET_HEAD_FRAC = 0.60;
  const targetHeadH = height * TARGET_HEAD_FRAC;
  const scale       = targetHeadH / headH;
  const scaledW     = headW * scale;

  const destHeadX  = (width - scaledW) / 2;
  const destBodyY  = targetHeadH;
  const srcBodyH   = height - headBottom;
  const dstBodyH   = height - destBodyY;

  const out    = document.createElement('canvas');
  out.width    = width;
  out.height   = height;
  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';

  // Body: original pixels below the head region
  if (srcBodyH > 0 && dstBodyH > 0) {
    outCtx.drawImage(
      canvas,
      0, headBottom, width, srcBodyH,
      0, destBodyY,  width, dstBodyH,
    );
  }

  // Head: scaled up, centred horizontally
  outCtx.drawImage(
    canvas,
    headLeft, headTop, headW, headH,
    destHeadX, 0,      scaledW, targetHeadH,
  );

  // Store the mapping so Stage 2 can remap landmarks
  canvas._headMap = { headLeft, headTop, headW, headH, scaledW, targetHeadH, destHeadX };

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(out, 0, 0);
}

// ─── Stage 2: eye & mouth bulge magnification ────────────────────────────────

function featureBulge(canvas, detection) {
  const map = canvas._headMap;
  const lm  = detection.landmarks;

  // Remap a landmark point from original-image space into the new head space
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
    featureDesc(lm.getLeftEye(),  3.2, 0.60),
    featureDesc(lm.getRightEye(), 3.2, 0.60),
    featureDesc(lm.getMouth(),    2.4, 0.52),
  ];

  applyBulge(canvas, features);
}

/**
 * Radial bulge (magnifying-lens) distortion.
 * For each output pixel inside a feature's radius, the source coordinate is
 * pulled toward the feature centre, making the region appear larger.
 *
 * strength: 0 = no effect, 1 = extreme bulge.
 */
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
