/**
 * Simulates multi-step image processing: resize, colour-correct, sharpen, encode.
 *
 * BUG: onProgress is only called once (at 5%) when the job starts.
 * The subsequent heavy steps never report back, so the UI stays frozen at 5%.
 */
export async function processImage(file, onProgress) {
  // Report that we've started – and then go silent for the rest of the run.
  onProgress(5);

  // Step 1 – decode / read the image into a bitmap
  const bitmap = await createImageBitmap(file);

  // Step 2 – draw onto an offscreen canvas (simulates resize)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  // Step 3 – colour correction (simulated delay)
  await delay(400);

  // Step 4 – sharpening pass (simulated delay)
  await delay(400);

  // Step 5 – encoding to blob
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 });

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
