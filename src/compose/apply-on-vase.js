function drawBase(baseImage, targetCanvas) {
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(baseImage, 0, 0, targetCanvas.width, targetCanvas.height);
}

function getOpaqueBounds(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[(y * width + x) * 4 + 3];
      if (alpha > 18) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const margin = 8;
  const sx = Math.max(0, minX - margin);
  const sy = Math.max(0, minY - margin);
  const ex = Math.min(width - 1, maxX + margin);
  const ey = Math.min(height - 1, maxY + margin);

  return {
    sx,
    sy,
    sw: ex - sx + 1,
    sh: ey - sy + 1,
  };
}

export function composeOnVase(baseImage, drawingCanvas, outputCanvas) {
  const ctx = outputCanvas.getContext("2d");
  drawBase(baseImage, outputCanvas);

  // Fascia decorabile approssimata per MVP sulla pancia del vaso.
  const cx = outputCanvas.width * 0.5;
  const cy = outputCanvas.height * 0.53;
  const rx = outputCanvas.width * 0.33;
  const ry = outputCanvas.height * 0.11;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.globalAlpha = 0.8;
  ctx.globalCompositeOperation = "multiply";
  const bounds = getOpaqueBounds(drawingCanvas);
  if (bounds) {
    ctx.drawImage(
      drawingCanvas,
      bounds.sx,
      bounds.sy,
      bounds.sw,
      bounds.sh,
      cx - rx,
      cy - ry,
      rx * 2,
      ry * 2
    );
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
