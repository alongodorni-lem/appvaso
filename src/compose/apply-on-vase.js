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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgbToCss(rgb) {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

function shiftColor(rgb, delta) {
  return {
    r: clamp(rgb.r + delta, 0, 255),
    g: clamp(rgb.g + delta, 0, 255),
    b: clamp(rgb.b + delta, 0, 255),
  };
}

function sampleAverageColor(ctx, x, y, width, height) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.floor(width));
  const sh = Math.max(1, Math.floor(height));
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 10) {
      continue;
    }
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }

  if (count === 0) {
    return { r: 130, g: 90, b: 60 };
  }

  return { r: r / count, g: g / count, b: b / count };
}

function colorizeInk(inkCanvas, colorCss) {
  const canvas = document.createElement("canvas");
  canvas.width = inkCanvas.width;
  canvas.height = inkCanvas.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(inkCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = colorCss;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
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
    darkCanvas,
    lightCanvas,
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
      darkCanvas,
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
      lightCanvas,
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

export function composeOnVase(baseImage, drawingCanvas, outputCanvas) {
  const ctx = outputCanvas.getContext("2d");
  drawBase(baseImage, outputCanvas);

  // Fascia alta tra le bande chiare superiori.
  const cx = outputCanvas.width * 0.5;
  const cy = outputCanvas.height * 0.49;
  const rx = outputCanvas.width * 0.33;
  const ry = outputCanvas.height * 0.095;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const bounds = getOpaqueBounds(drawingCanvas);
  if (bounds) {
    const inkCanvas = buildInkCanvas(drawingCanvas, bounds);
    const avg = sampleAverageColor(
      ctx,
      cx - rx * 0.7,
      cy - ry * 0.7,
      rx * 1.4,
      ry * 1.4
    );
    const darkInk = colorizeInk(inkCanvas, rgbToCss(shiftColor(avg, -45)));
    const lightInk = colorizeInk(inkCanvas, rgbToCss(shiftColor(avg, 38)));
    const ratio = inkCanvas.width / inkCanvas.height;
    const maxDestWidth = rx * 1.78;
    const maxDestHeight = ry * 0.72;
    let destWidth = maxDestWidth;
    let destHeight = destWidth / ratio;
    if (destHeight > maxDestHeight) {
      destHeight = maxDestHeight;
      destWidth = destHeight * ratio;
    }

    const dx = cx - destWidth / 2;
    const dy = cy - destHeight / 2 - ry * 0.03;

    drawCurvedTextBand(ctx, inkCanvas, {
      x: dx,
      y: dy,
      width: destWidth,
      height: destHeight,
      centerDipPx: outputCanvas.height * 0.024,
      edgeCompression: 0.36,
      darkAlpha: 0.6,
      lightAlpha: 0.23,
      darkCanvas: darkInk,
      lightCanvas: lightInk,
    });
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
