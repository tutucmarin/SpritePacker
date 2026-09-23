export type AtlasImageFormat = "png" | "webp" | "jpeg";

export function atlasFormatFromFile(file: File): AtlasImageFormat {
  const type = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpeg";
  if (type === "image/png") return "png";
  if (extension === "webp") return "webp";
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  return "png";
}

export function atlasFormatInfo(format: AtlasImageFormat): {
  mime: string;
  extension: string;
} {
  if (format === "webp") return { mime: "image/webp", extension: "webp" };
  if (format === "jpeg") return { mime: "image/jpeg", extension: "jpg" };
  return { mime: "image/png", extension: "png" };
}
