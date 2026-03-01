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
  const dst = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC4);

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
  const srcData = src.data;
  const maskData = mask.data;
  const dstData = dst.data;
  for (let i = 0, p = 0; i < dstData.length; i += 4, p += 1) {
    if (maskData[p] > 25) {
      // Keep the original handwriting color from the captured frame.
      dstData[i] = srcData[i];
      dstData[i + 1] = srcData[i + 1];
      dstData[i + 2] = srcData[i + 2];
      dstData[i + 3] = 255;
    } else {
      dstData[i + 3] = 0;
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
