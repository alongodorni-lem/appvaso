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

export function snapFrame(videoElement, targetCanvas) {
  const ctx = targetCanvas.getContext("2d");
  const width = videoElement.videoWidth || 1024;
  const height = videoElement.videoHeight || 768;
  targetCanvas.width = width;
  targetCanvas.height = height;
  ctx.drawImage(videoElement, 0, 0, width, height);
}
