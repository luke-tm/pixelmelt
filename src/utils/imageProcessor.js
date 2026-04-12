/**
 * Multi-step image processing: resize, colour-correct, sharpen, encode.
 * Progress is reported after each distinct step so the UI bar advances smoothly.
 */
export async function processImage(file, onProgress) {
  // Step 1 – decode / read the image into a bitmap
  onProgress(5);
  const bitmap = await createImageBitmap(file);

  // Step 2 – draw onto an offscreen canvas (simulates resize)
  onProgress(25);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  // Step 3 – colour correction (simulated delay)
  onProgress(50);
  await delay(400);

  // Step 4 – sharpening pass (simulated delay)
  onProgress(75);
  await delay(400);

  // Step 5 – encoding to blob
  onProgress(90);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 });

  onProgress(100);

  // Build a metadata object the gallery can use
  return {
    id: crypto.randomUUID(),
    name: file.name,
    originalSize: file.size,
    processedSize: blob.size,
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    processedAt: new Date().toISOString(),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
