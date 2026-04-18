/**
 * Multi-step image processing: resize, colour-correct, sharpen, encode.
 * Progress is reported after each distinct step so the UI bar advances smoothly.
 */

// iOS Safari tiles GPU textures above 4096 px in either dimension, producing
// visible seam lines at every tile boundary in the encoded output.
// Clamp to this limit so the entire image fits in a single GPU tile.
const MAX_DIMENSION = 2048;

export async function processImage(file, onProgress) {
  // Step 1 – fully decode the image before touching any pixels.
  onProgress(5);
  const { img, objectUrl } = await loadImage(file);

  // Step 2 – draw at a safe canvas resolution.
  // Passing explicit target dimensions to drawImage prevents sub-pixel
  // rounding discrepancies when the browser picks an intermediate size.
  onProgress(25);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(objectUrl);

  // Step 3 – colour correction (simulated delay)
  onProgress(50);
  await delay(400);

  // Step 4 – sharpening pass (simulated delay)
  onProgress(75);
  await delay(400);

  // Step 5 – encode to blob (WebP with JPEG fallback)
  onProgress(90);
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
    processedAt: new Date().toISOString(),
  };
}

/**
 * Scale dimensions down so neither side exceeds maxDimension.
 * Returns original dimensions if already within bounds.
 */
function fitWithin(w, h, maxDimension) {
  const scale = Math.min(1, maxDimension / w, maxDimension / h);
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

/**
 * Load a File into an HTMLImageElement and wait for full pixel decode.
 * img.decode() guarantees the complete pixel buffer is ready before resolving.
 */
async function loadImage(file) {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await img.decode();
  return { img, objectUrl };
}

/**
 * Encode canvas to a blob, preferring WebP with a JPEG fallback.
 */
function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // WebP encoding not supported — fall back to JPEG
          canvas.toBlob(
            (jpegBlob) =>
              jpegBlob
                ? resolve(jpegBlob)
                : reject(new Error('Canvas encoding failed')),
            'image/jpeg',
            0.92
          );
        }
      },
      'image/webp',
      0.92
    );
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
