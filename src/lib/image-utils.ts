export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (e) => reject(e);
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
  URL.revokeObjectURL(url);
}

export function safeProjectName(name: string) {
  const n = (name || "project").trim() || "project";
  return n.replace(/[^a-zA-Z0-9_\\-]+/g, "_");
}
