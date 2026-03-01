import { markerConfig } from "./marker-config.js";

export function setupArScene(vasePlane, textureCanvas) {
  if (!vasePlane) {
    throw new Error("Elemento AR vasePlane non trovato.");
  }

  vasePlane.setAttribute("width", markerConfig.planeWidth);
  vasePlane.setAttribute("height", markerConfig.planeHeight);
  vasePlane.setAttribute("material", {
    src: "#vaseTextureCanvas",
    transparent: true,
    side: "double",
  });

  const applyCanvasTexture = () => {
    if (!vasePlane.object3D || vasePlane.object3D.children.length === 0) {
      return;
    }
    const mesh = vasePlane.object3D.children[0];
    if (!mesh?.material) {
      return;
    }
    mesh.material.map = new THREE.CanvasTexture(textureCanvas);
    mesh.material.map.needsUpdate = true;
    mesh.material.needsUpdate = true;
  };

  applyCanvasTexture();
  vasePlane.addEventListener("loaded", applyCanvasTexture, { once: true });
}

export function refreshPlaneTexture(vasePlane) {
  if (!vasePlane?.object3D) {
    return;
  }

  const mesh = vasePlane.object3D.children[0];
  if (!mesh?.material?.map) {
    return;
  }
  mesh.material.map.needsUpdate = true;
}
