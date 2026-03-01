function drawBase(baseImage, targetCanvas) {
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(baseImage, 0, 0, targetCanvas.width, targetCanvas.height);
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
  ctx.drawImage(
    drawingCanvas,
    cx - rx,
    cy - ry,
    rx * 2,
    ry * 2
  );

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
