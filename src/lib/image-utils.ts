export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromBlob(file);
}

export async function loadImageFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<HTMLImageElement> {
  try {
    const blob = await toBlob(canvas, "image/png");
    return await loadImageFromBlob(blob);
  } finally {
    // All callers pass temporary canvases. Clearing their backing stores releases
    // the decoded pixels as soon as the encoded image has been created.
    canvas.width = 0;
    canvas.height = 0;
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    image.src = url;
  });
}

export function mergeImagesVertical(
  a: HTMLImageElement,
  b: HTMLImageElement,
): HTMLImageElement {
  const w = Math.max(a.width, b.width);
  const h = a.height + b.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(a, 0, 0);
  ctx.drawImage(b, 0, a.height);
  const out = new Image();
  out.src = canvas.toDataURL("image/png");
  return out;
}

export async function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      type,
      quality,
    );
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a task to begin the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeProjectName(name: string) {
  const n = (name || "project").trim() || "project";
  return n.replace(/[^a-zA-Z0-9_\\-]+/g, "_");
}
