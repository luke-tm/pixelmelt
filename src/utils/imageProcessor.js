/**
 * Multi-step image processing: resize, colour-correct, sharpen, encode.
 * Progress is reported after each distinct step so the UI bar advances smoothly.
 */
export async function processImage(file, onProgress) {
  // Step 1 – fully decode the image before touching any pixels.
  // createImageBitmap() can resolve before decoding is complete on some
  // browsers, causing partial-decode artefacts (horizontal breaks) when the
  // bitmap is drawn to canvas. img.decode() guarantees the full pixel data
  // is ready before the promise resolves.
  onProgress(5);
  const { img, objectUrl } = await loadImage(file);

  // Step 2 – draw onto a canvas at native resolution
  onProgress(25);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // The object URL is no longer needed once the image is drawn
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
    width: img.naturalWidth,
    height: img.naturalHeight,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Load a File into an HTMLImageElement and wait for full pixel decode.
 * img.decode() is supported in all modern browsers including iOS Safari 12+.
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
