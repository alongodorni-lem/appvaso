import { setupArScene, refreshPlaneTexture } from "./ar/scene.js";
import { startCapture, stopCapture, snapFrame } from "./capture/capture-drawing.js";
import { extractDrawing } from "./capture/extract-drawing.js";
import { composeOnVase } from "./compose/apply-on-vase.js";

const VASE_VIDEO_CANDIDATES = [
  "./assets/vase-spin.MP4",
  "./assets/vase-spin.mp4",
];

const VASE_IMAGE_CANDIDATES = [
  "./assets/vase-base.png",
  "./assets/c__Users_along_AppData_Roaming_Cursor_User_workspaceStorage_90f16c51277a9e8199eb3a85f42da987_images_museobianchetti_vaso_latumaro-6d2ad710-0526-4d39-83f4-98c2e0321350.png",
];

const ui = {
  status: document.getElementById("status"),
  startCaptureBtn: document.getElementById("startCaptureBtn"),
  applyBtn: document.getElementById("applyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  snapBtn: document.getElementById("snapBtn"),
  closeCaptureBtn: document.getElementById("closeCaptureBtn"),
  captureModal: document.getElementById("captureModal"),
  captureVideo: document.getElementById("captureVideo"),
  captureFrame: document.getElementById("captureFrame"),
};

const canvases = {
  vaseTexture: document.getElementById("vaseTextureCanvas"),
  drawing: document.getElementById("drawingCanvas"),
  processed: document.getElementById("processedCanvas"),
};

const vasePlane = document.getElementById("vasePlane");

let captureStream;
let baseSource;
let baseVideo;
let hasDrawing = false;
let hasAppliedName = false;
let isVideoMode = false;
let renderLoopId;
const VIDEO_EXPORT_MS = 4000;

function isIPhoneSafari() {
  const ua = navigator.userAgent || "";
  const isIPhone = /iPhone/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isIPhone && isSafari;
}

function setStatus(message) {
  ui.status.textContent = `Stato: ${message}`;
}

function patchInlineVideoAttributes() {
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.controls = false;
  });
}

function scheduleSafariVideoFixes() {
  if (!isIPhoneSafari()) {
    return;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    patchInlineVideoAttributes();
    attempts += 1;
    if (attempts >= 80) {
      clearInterval(timer);
    }
  }, 300);

  const observer = new MutationObserver(() => {
    patchInlineVideoAttributes();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => observer.disconnect(), 30000);
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile caricare l'immagine del vaso."));
    img.src = path;
  });
}

function loadVideo(path) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = path;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");

    const onLoaded = async () => {
      try {
        await video.play();
      } catch (_error) {
        // Safari may delay autoplay until a user gesture; keep loaded video anyway.
      }
      resolve(video);
    };

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("error", () => reject(new Error("Impossibile caricare il video del vaso.")), { once: true });
  });
}

async function loadFirstAvailableVideo(paths) {
  for (const path of paths) {
    try {
      const video = await loadVideo(path);
      return video;
    } catch (_error) {
      // Continue with next candidate path.
    }
  }
  throw new Error("Impossibile caricare il video del vaso da nessun path.");
}

async function loadFirstAvailableImage(paths) {
  for (const path of paths) {
    try {
      const image = await loadImage(path);
      return image;
    } catch (_error) {
      // Continue with next candidate path.
    }
  }
  throw new Error("Impossibile caricare l'immagine del vaso da nessun path.");
}

function openCaptureModal() {
  ui.captureModal.classList.remove("hidden");
}

function closeCaptureModal() {
  ui.captureModal.classList.add("hidden");
}

function getFrameSourceRect(videoElement, frameElement) {
  const videoRect = videoElement.getBoundingClientRect();
  const frameRect = frameElement.getBoundingClientRect();

  if (!videoRect.width || !videoRect.height) {
    return null;
  }

  const scaleX = (videoElement.videoWidth || 1) / videoRect.width;
  const scaleY = (videoElement.videoHeight || 1) / videoRect.height;

  const x = (frameRect.left - videoRect.left) * scaleX;
  const y = (frameRect.top - videoRect.top) * scaleY;
  const width = frameRect.width * scaleX;
  const height = frameRect.height * scaleY;

  return { x, y, width, height };
}

function drawBaseToTexture() {
  const ctx = canvases.vaseTexture.getContext("2d");
  ctx.clearRect(0, 0, canvases.vaseTexture.width, canvases.vaseTexture.height);
  ctx.drawImage(baseSource, 0, 0, canvases.vaseTexture.width, canvases.vaseTexture.height);
}

function getVideoPhase(video) {
  if (!video || !video.duration || !Number.isFinite(video.duration) || video.duration <= 0) {
    return 0;
  }
  const normalized = (video.currentTime % video.duration) / video.duration;
  return normalized;
}

function renderArTextureFrame() {
  if (!baseSource) {
    return;
  }

  if (isVideoMode && baseVideo && baseVideo.readyState < 2) {
    renderLoopId = requestAnimationFrame(renderArTextureFrame);
    return;
  }

  if (hasAppliedName) {
    const phase = isVideoMode ? getVideoPhase(baseVideo) : 0;
    composeOnVase(baseSource, canvases.processed, canvases.vaseTexture, { phase });
  } else {
    drawBaseToTexture();
  }

  refreshPlaneTexture(vasePlane);

  if (isVideoMode) {
    renderLoopId = requestAnimationFrame(renderArTextureFrame);
  } else {
    renderLoopId = undefined;
  }
}

function pickMediaRecorderMimeType() {
  if (!window.MediaRecorder) {
    return null;
  }
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

async function exportVaseVideo(canvas, video, durationMs) {
  if (!canvas.captureStream || !window.MediaRecorder) {
    throw new Error("Esportazione video non supportata su questo browser.");
  }

  const mimeType = pickMediaRecorderMimeType();
  if (mimeType === null) {
    throw new Error("MediaRecorder non disponibile su questo browser.");
  }

  const stream = canvas.captureStream(30);
  const chunks = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const previousLoop = video.loop;
  const previousMuted = video.muted;
  video.loop = false;
  video.muted = true;
  video.currentTime = 0;
  await video.play();

  const effectiveDuration = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(durationMs, Math.floor(video.duration * 1000))
    : durationMs;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, effectiveDuration + 120);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      clearTimeout(timeoutId);
      stream.getTracks().forEach((track) => track.stop());
      video.loop = previousLoop;
      video.muted = previousMuted;
      reject(event.error || new Error("Errore durante registrazione video."));
    };

    recorder.onstop = () => {
      clearTimeout(timeoutId);
      stream.getTracks().forEach((track) => track.stop());
      video.loop = previousLoop;
      video.muted = previousMuted;
      video.currentTime = 0;
      video.play().catch(() => {});

      if (!chunks.length) {
        reject(new Error("Nessun frame video registrato."));
        return;
      }

      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      resolve(blob);
    };

    video.onended = () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };

    recorder.start();
  });
}

async function initialize() {
  setStatus("caricamento vaso...");
  scheduleSafariVideoFixes();
  try {
    baseVideo = await loadFirstAvailableVideo(VASE_VIDEO_CANDIDATES);
    baseSource = baseVideo;
    isVideoMode = true;
    setStatus("video vaso caricato.");
  } catch (_error) {
    baseSource = await loadFirstAvailableImage(VASE_IMAGE_CANDIDATES);
    isVideoMode = false;
    setStatus("immagine vaso caricata.");
  }

  const width = isVideoMode ? (baseVideo.videoWidth || 1024) : 1024;
  const height = isVideoMode ? (baseVideo.videoHeight || 1024) : 1024;
  canvases.vaseTexture.width = width;
  canvases.vaseTexture.height = height;
  drawBaseToTexture();

  setupArScene(vasePlane, canvases.vaseTexture);
  if (isVideoMode) {
    ui.saveBtn.textContent = "Salva video";
  } else {
    ui.saveBtn.textContent = "Salva foto";
  }
  setStatus("pronto. inquadra il marker HIRO.");

  if (isVideoMode) {
    if (renderLoopId) {
      cancelAnimationFrame(renderLoopId);
    }
    renderLoopId = undefined;
    renderArTextureFrame();
  }
}

async function onStartCapture() {
  try {
    openCaptureModal();
    setStatus("attiva la camera e allinea il nome scritto nel riquadro.");
    captureStream = await startCapture(ui.captureVideo);
    setStatus("camera attiva. allinea il nome nel riquadro e premi Scatta.");
  } catch (_error) {
    closeCaptureModal();
    setStatus("errore camera. controlla i permessi del browser.");
  }
}

async function onSnap() {
  if (!captureStream) {
    setStatus("camera non disponibile.");
    return;
  }

  setStatus("acquisizione in corso...");
  const sourceRect = getFrameSourceRect(ui.captureVideo, ui.captureFrame);
  snapFrame(ui.captureVideo, canvases.drawing, sourceRect);
  await extractDrawing(canvases.drawing, canvases.processed);

  hasDrawing = true;
  ui.applyBtn.disabled = false;
  closeCaptureModal();
  stopCapture(captureStream);
  captureStream = undefined;
  setStatus("nome acquisito. premi Applica al vaso.");
}

function onApply() {
  if (!hasDrawing) {
    setStatus("acquisisci prima il nome.");
    return;
  }

  hasAppliedName = true;

  if (isVideoMode && baseVideo && baseVideo.paused) {
    baseVideo.play().catch(() => {});
  }

  if (isVideoMode) {
    if (!renderLoopId) {
      renderArTextureFrame();
    }
  } else {
    renderArTextureFrame();
  }

  ui.saveBtn.disabled = false;
  setStatus("nome applicato al vaso AR.");
}

async function onSave() {
  if (isVideoMode && baseVideo) {
    if (!hasAppliedName) {
      setStatus("applica prima il nome al vaso.");
      return;
    }
    try {
      ui.saveBtn.disabled = true;
      setStatus("esportazione video in corso...");
      const blob = await exportVaseVideo(canvases.vaseTexture, baseVideo, VIDEO_EXPORT_MS);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `vaso-ar-${Date.now()}.webm`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus("video salvato.");
    } catch (_error) {
      setStatus("salvataggio video non supportato su questo browser.");
    } finally {
      ui.saveBtn.disabled = false;
    }
    return;
  }

  const url = canvases.vaseTexture.toDataURL("image/png");
  triggerDownload(url, `vaso-ar-${Date.now()}.png`);
  setStatus("immagine salvata.");
}

function onCloseCapture() {
  closeCaptureModal();
  stopCapture(captureStream);
  captureStream = undefined;
  setStatus("acquisizione annullata.");
}

ui.startCaptureBtn.addEventListener("click", onStartCapture);
ui.snapBtn.addEventListener("click", onSnap);
ui.applyBtn.addEventListener("click", onApply);
ui.saveBtn.addEventListener("click", onSave);
ui.closeCaptureBtn.addEventListener("click", onCloseCapture);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isIPhoneSafari()) {
    patchInlineVideoAttributes();
  }
});

initialize().catch((error) => {
  console.error(error);
  setStatus("errore inizializzazione. controlla il path dell'immagine.");
});
