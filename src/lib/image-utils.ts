export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  if (!file.size) {
    throw new Error(`"${file.name}" is empty.`);
  }

  const inferredType = imageMimeTypeFromName(file.name);
  const normalized =
    inferredType && inferredType !== file.type.toLowerCase()
      ? file.slice(0, file.size, inferredType)
      : file;

  try {
    return await loadImageFromBlob(normalized);
  } catch {
    // Some file pickers provide an empty or generic MIME type. Try the original
    // blob too, since browsers can occasionally identify a format by its bytes.
    if (normalized !== file) {
      try {
        return await loadImageFromBlob(file);
      } catch {
        // Fall through to the useful, file-specific error below.
      }
    }
    throw new Error(
      `Could not read "${file.name}". The file may be invalid or use an image format this browser does not support.`,
    );
  }
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

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  try {
    return await loadImageElement(blob);
  } catch (imageError) {
    // createImageBitmap uses a separate browser decoder on some platforms and
    // recovers formats that an HTMLImageElement cannot decode from a Blob URL.
    if (typeof createImageBitmap !== "function") throw imageError;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(blob);
      if (!bitmap.width || !bitmap.height) throw imageError;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw imageError;
      context.drawImage(bitmap, 0, 0);
      const png = await toBlob(canvas, "image/png");
      canvas.width = 0;
      canvas.height = 0;
      return await loadImageElement(png);
    } catch {
      throw imageError;
    } finally {
      bitmap?.close();
    }
  }
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new Error("Decoded image has no pixels"));
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

function imageMimeTypeFromName(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
    case "apng":
      return "image/png";
    case "jpg":
    case "jpeg":
    case "jfif":
    case "pjpeg":
    case "pjp":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
    case "dib":
      return "image/bmp";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return null;
  }
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
