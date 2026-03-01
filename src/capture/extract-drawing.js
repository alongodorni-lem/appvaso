function waitForOpenCv() {
  return new Promise((resolve) => {
    if (window.cv && typeof window.cv.imread === "function") {
      resolve();
      return;
    }

    const intervalId = setInterval(() => {
      if (window.cv && typeof window.cv.imread === "function") {
        clearInterval(intervalId);
        resolve();
      }
    }, 200);
  });
}

function extractFallback(sourceCanvas, destinationCanvas) {
  const srcCtx = sourceCanvas.getContext("2d");
  const dstCtx = destinationCanvas.getContext("2d");
  destinationCanvas.width = sourceCanvas.width;
  destinationCanvas.height = sourceCanvas.height;

  const imageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;

    if (brightness > 220) {
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
    }
  }

  dstCtx.putImageData(imageData, 0, 0);
}

export async function extractDrawing(sourceCanvas, destinationCanvas) {
  destinationCanvas.width = sourceCanvas.width;
  destinationCanvas.height = sourceCanvas.height;

  try {
    await waitForOpenCv();
  } catch (_error) {
    extractFallback(sourceCanvas, destinationCanvas);
    return;
  }

  if (!window.cv || typeof window.cv.imread !== "function") {
    extractFallback(sourceCanvas, destinationCanvas);
    return;
  }

  const cv = window.cv;
  const src = cv.imread(sourceCanvas);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const mask = new cv.Mat();
  const dst = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  cv.adaptiveThreshold(
    blur,
    mask,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    31,
    6
  );
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
  cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
  cv.cvtColor(mask, dst, cv.COLOR_GRAY2RGBA, 0);

  const rgbaData = dst.data;
  for (let i = 0; i < rgbaData.length; i += 4) {
    if (rgbaData[i] < 25) {
      rgbaData[i + 3] = 0;
    } else {
      rgbaData[i] = 30;
      rgbaData[i + 1] = 30;
      rgbaData[i + 2] = 30;
      rgbaData[i + 3] = 255;
    }
  }

  cv.imshow(destinationCanvas, dst);

  src.delete();
  gray.delete();
  blur.delete();
  mask.delete();
  dst.delete();
  kernel.delete();
}
