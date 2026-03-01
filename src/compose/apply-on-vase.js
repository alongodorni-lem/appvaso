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

function buildInkCanvas(sourceCanvas, bounds) {
  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = bounds.sw;
  inkCanvas.height = bounds.sh;
  const inkCtx = inkCanvas.getContext("2d");

  inkCtx.drawImage(
    sourceCanvas,
    bounds.sx,
    bounds.sy,
    bounds.sw,
    bounds.sh,
    0,
    0,
    bounds.sw,
    bounds.sh
  );

  return inkCanvas;
}

function drawCurvedTextBand(ctx, inkCanvas, config) {
  const {
    x,
    y,
    width,
    height,
    centerDipPx,
    edgeCompression,
    darkAlpha,
    lightAlpha,
  } = config;

  const srcW = inkCanvas.width;
  const srcH = inkCanvas.height;
  const sliceW = 2;

  for (let sx = 0; sx < srcW; sx += sliceW) {
    const sw = Math.min(sliceW, srcW - sx);
    const t = (sx + sw * 0.5) / srcW;
    const norm = (t - 0.5) * 2;

    const centerWeight = 1 - norm * norm;
    const curveY = y + centerWeight * centerDipPx;
    const compressedH = height * (1 - Math.abs(norm) * edgeCompression);
    const yOffset = (height - compressedH) * 0.5;

    const dx = x + t * width;
    const dw = (sw / srcW) * width + 0.5;

    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = darkAlpha;
    ctx.drawImage(
      inkCanvas,
      sx,
      0,
      sw,
      srcH,
      dx,
      curveY + yOffset + 1,
      dw,
      compressedH
    );

    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = lightAlpha;
    ctx.drawImage(
      inkCanvas,
      sx,
      0,
      sw,
      srcH,
      dx,
      curveY + yOffset - 1,
      dw,
      compressedH
    );
  }
}

// Calibration block for spinning-vase video tracking.
// Tune these values if the name appears slightly early/late or too wide/narrow.
const VIDEO_TRACKING = {
  phaseOffset: 0.08,
  rotationCycles: 0.9,
  direction: 1,
  xAmplitude: 0.58,
  minFrontVisibility: 0.08,
  minWidthScale: 0.3,
};

function getRotationMapping(phase) {
  const mapped = ((phase * VIDEO_TRACKING.rotationCycles) + VIDEO_TRACKING.phaseOffset) % 1;
  const angle = mapped * Math.PI * 2 * VIDEO_TRACKING.direction;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const front = Math.max(cos, VIDEO_TRACKING.minFrontVisibility);
  return {
    front,
    sin,
  };
}

export function composeOnVase(baseImage, drawingCanvas, outputCanvas, options = {}) {
  const ctx = outputCanvas.getContext("2d");
  drawBase(baseImage, outputCanvas);

  // Fascia alta tra le bande chiare superiori.
  const cx = outputCanvas.width * 0.5;
  const cy = outputCanvas.height * 0.49;
  const rx = outputCanvas.width * 0.33;
  const ry = outputCanvas.height * 0.095;

  const phase = typeof options.phase === "number" ? options.phase : 0;
  const mapping = getRotationMapping(phase);
  if (mapping.front < 0.05) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const bounds = getOpaqueBounds(drawingCanvas);
  if (bounds) {
    const inkCanvas = buildInkCanvas(drawingCanvas, bounds);
    const ratio = inkCanvas.width / inkCanvas.height;
    const maxDestWidth = rx * 1.78;
    const maxDestHeight = ry * 0.72;
    let destWidth = maxDestWidth;
    let destHeight = destWidth / ratio;
    if (destHeight > maxDestHeight) {
      destHeight = maxDestHeight;
      destWidth = destHeight * ratio;
    }

    const widthScale = VIDEO_TRACKING.minWidthScale + mapping.front * (1 - VIDEO_TRACKING.minWidthScale);
    destWidth *= widthScale;
    const xShift = mapping.sin * rx * VIDEO_TRACKING.xAmplitude;
    const dx = cx - destWidth / 2 + xShift;
    const dy = cy - destHeight / 2 - ry * 0.03;
    const edgeCompression = 0.26 + (1 - mapping.front) * 0.5;
    const darkAlpha = 0.4 + mapping.front * 0.48;
    const lightAlpha = 0.08 + mapping.front * 0.14;

    drawCurvedTextBand(ctx, inkCanvas, {
      x: dx,
      y: dy,
      width: destWidth,
      height: destHeight,
      centerDipPx: outputCanvas.height * 0.024,
      edgeCompression,
      darkAlpha,
      lightAlpha,
    });
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
