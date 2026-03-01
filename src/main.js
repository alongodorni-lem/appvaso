import { setupArScene, refreshPlaneTexture } from "./ar/scene.js";
import { startCapture, stopCapture, snapFrame } from "./capture/capture-drawing.js";
import { extractDrawing } from "./capture/extract-drawing.js";
import { composeOnVase } from "./compose/apply-on-vase.js";

const VASE_IMAGE_CANDIDATES = [
  "./assets/vase-base.png",
  "./assets/c__Users_along_AppData_Roaming_Cursor_User_workspaceStorage_90f16c51277a9e8199eb3a85f42da987_images_museobianchetti_vaso_latumaro-6d2ad710-0526-4d39-83f4-98c2e0321350.png",
];

const ui = {
  status: document.getElementById("status"),
  iosFixBtn: document.getElementById("iosFixBtn"),
  startCaptureBtn: document.getElementById("startCaptureBtn"),
  applyBtn: document.getElementById("applyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  snapBtn: document.getElementById("snapBtn"),
  closeCaptureBtn: document.getElementById("closeCaptureBtn"),
  captureModal: document.getElementById("captureModal"),
  captureVideo: document.getElementById("captureVideo"),
};

const canvases = {
  vaseTexture: document.getElementById("vaseTextureCanvas"),
  drawing: document.getElementById("drawingCanvas"),
  processed: document.getElementById("processedCanvas"),
};

const vasePlane = document.getElementById("vasePlane");

let captureStream;
let baseImage;
let hasDrawing = false;

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
    if (attempts >= 15) {
      clearInterval(timer);
    }
  }, 300);
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

async function onIosFix() {
  if (!isIPhoneSafari()) {
    setStatus("Fix iPhone disponibile solo su Safari iPhone.");
    return;
  }

  try {
    setStatus("attivazione camera iPhone...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    patchInlineVideoAttributes();
    setStatus("camera iPhone attivata. ricarico la pagina AR...");
    setTimeout(() => window.location.reload(), 450);
  } catch (_error) {
    setStatus("permesso camera negato o non disponibile su Safari.");
  }
}

async function initialize() {
  setStatus("caricamento immagine vaso...");
  scheduleSafariVideoFixes();
  baseImage = await loadFirstAvailableImage(VASE_IMAGE_CANDIDATES);

  canvases.vaseTexture.width = 1024;
  canvases.vaseTexture.height = 1024;
  const ctx = canvases.vaseTexture.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, canvases.vaseTexture.width, canvases.vaseTexture.height);

  setupArScene(vasePlane, canvases.vaseTexture);
  if (isIPhoneSafari()) {
    setStatus("iPhone: premi 'Attiva AR iPhone' se lo sfondo resta nero.");
  } else {
    setStatus("pronto. inquadra il marker HIRO.");
  }
}

async function onStartCapture() {
  try {
    openCaptureModal();
    setStatus("attiva la camera per acquisire il foglio...");
    captureStream = await startCapture(ui.captureVideo);
    setStatus("camera attiva. premi Scatta.");
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
  snapFrame(ui.captureVideo, canvases.drawing);
  await extractDrawing(canvases.drawing, canvases.processed);

  hasDrawing = true;
  ui.applyBtn.disabled = false;
  closeCaptureModal();
  stopCapture(captureStream);
  captureStream = undefined;
  setStatus("disegno acquisito. premi Applica al vaso.");
}

function onApply() {
  if (!hasDrawing) {
    setStatus("acquisisci prima un disegno.");
    return;
  }

  composeOnVase(baseImage, canvases.processed, canvases.vaseTexture);
  refreshPlaneTexture(vasePlane);
  ui.saveBtn.disabled = false;
  setStatus("decorazione applicata al vaso AR.");
}

function onSave() {
  const link = document.createElement("a");
  link.download = `vaso-ar-${Date.now()}.png`;
  link.href = canvases.vaseTexture.toDataURL("image/png");
  link.click();
  setStatus("immagine salvata.");
}

function onCloseCapture() {
  closeCaptureModal();
  stopCapture(captureStream);
  captureStream = undefined;
  setStatus("acquisizione annullata.");
}

ui.startCaptureBtn.addEventListener("click", onStartCapture);
ui.iosFixBtn.addEventListener("click", onIosFix);
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
