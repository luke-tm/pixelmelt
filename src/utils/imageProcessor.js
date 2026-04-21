/**
 * Multi-step image processing: resize → face detect → caricature → encode.
 * Progress is reported after each distinct step so the UI bar advances smoothly.
 *
 * caricature.js (face-api.js + TensorFlow.js) is lazy-loaded on first upload
 * so it doesn't inflate the initial page bundle.
 */

// iOS Safari tiles GPU textures above 4096 px in either dimension, producing
// visible seam lines at every tile boundary in the encoded output.
const MAX_DIMENSION = 2048;

export async function processImage(file, onProgress) {
  // Step 1 – lazy-load caricature module + face-detection models
  onProgress(5);
  const { loadModels, detectFace, applyCaricature } = await import('./caricature.js');
  await loadModels();

  // Step 2 – fully decode the image
  onProgress(15);
  const { img, objectUrl } = await loadImage(file);

  // Step 3 – draw at a safe canvas resolution
  onProgress(25);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(objectUrl);

  // Step 4 – detect face + landmarks
  onProgress(45);
  const detection = await detectFace(canvas);

  // Step 5 – caricature: big head + eye/mouth bulge (skipped if no face found)
  onProgress(60);
  applyCaricature(canvas, detection);

  // Step 6 – colour correction (simulated delay)
  onProgress(75);
  await delay(300);

  // Step 7 – sharpening pass (simulated delay)
  onProgress(88);
  await delay(300);

  // Step 8 – encode
  onProgress(94);
  const blob = await canvasToBlob(canvas);

  onProgress(100);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    originalSize: file.size,
    processedSize: blob.size,
    url: URL.createObjectURL(blob),
    width,
    height,
    caricature: detection !== null,
    processedAt: new Date().toISOString(),
  };
}

function fitWithin(w, h, maxDimension) {
  const scale = Math.min(1, maxDimension / w, maxDimension / h);
  return {
    width:  Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

async function loadImage(file) {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await img.decode();
  return { img, objectUrl };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          canvas.toBlob(
            (jpegBlob) =>
              jpegBlob
                ? resolve(jpegBlob)
                : reject(new Error('Canvas encoding failed')),
            'image/jpeg',
            0.92,
          );
        }
      },
      'image/webp',
      0.92,
    );
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
