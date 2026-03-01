export async function startCapture(videoElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

export function stopCapture(stream) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
}

function clampRect(rect, maxWidth, maxHeight) {
  const x = Math.max(0, Math.min(rect.x, maxWidth - 1));
  const y = Math.max(0, Math.min(rect.y, maxHeight - 1));
  const width = Math.max(1, Math.min(rect.width, maxWidth - x));
  const height = Math.max(1, Math.min(rect.height, maxHeight - y));
  return { x, y, width, height };
}

export function snapFrame(videoElement, targetCanvas, sourceRect) {
  const ctx = targetCanvas.getContext("2d");
  const videoWidth = videoElement.videoWidth || 1024;
  const videoHeight = videoElement.videoHeight || 768;

  if (sourceRect) {
    const rect = clampRect(sourceRect, videoWidth, videoHeight);
    targetCanvas.width = rect.width;
    targetCanvas.height = rect.height;
    ctx.drawImage(
      videoElement,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height
    );
    return;
  }

  targetCanvas.width = videoWidth;
  targetCanvas.height = videoHeight;
  ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
}
