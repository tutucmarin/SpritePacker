import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ComponentDetector } from "@/src/lib/component-detector";
import { currentMimeAndExt } from "@/src/lib/exporter";
import type { ComponentBox } from "@/src/lib/types";
import {
  loadImageFromFile,
  toBlob,
  triggerDownload,
  safeProjectName,
} from "@/src/lib/image-utils";
import { repackSprites } from "@/src/lib/packing";
import { useDisablePageZoom } from "@/src/hooks/useDisablePageZoom";
import { useThemePrefs, BackgroundMode } from "@/src/app/state/useThemePrefs";
import {
  filterNonOverlapping,
  orderBoxes,
  overlaps,
} from "@/src/lib/box-utils";
import { hashBytes } from "@/src/lib/hash";

export type JsonFormat =
  | "json-array"
  | "json-hash"
  | "pixi"
  | "phaser-array"
  | "phaser-hash"
  | "phaser3";

type DupReport = {
  count: number;
  groups: { hash: string; items: { idx: number; name: string }[] }[];
};

type SpritePackerState = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number | null;
  projectName: string;
  packerMode: "default" | "optimal" | "maxrect";
  jsonFormat: JsonFormat;
  spacing: number;
  atlasWidth: number | null;
  atlasHeight: number | null;
  fixedSize: boolean;
  downloadMode: "sprites" | "atlas";
  fmt: "png" | "jpeg" | "webp";
  quality: number;
  bgMode: "auto" | "alpha" | "key" | "custom";
  cclTol: number;
  background: BackgroundMode;
  theme: "light" | "dark";
  showSettings: boolean;
  dupReport: DupReport | null;
  selectedBox: ComponentBox | null;
};

type SpritePackerActions = {
  onFiles: (files?: FileList) => Promise<void>;
  onDetect: () => Promise<void>;
  onCustomJson: (file?: File) => Promise<void>;
  onSelect: (idx: number | null) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
  onAddBox: (box: ComponentBox) => number | null;
  onDeleteSelected: () => Promise<void>;
  onClearAll: () => void;
  onUpdateSelected: (next: ComponentBox) => void;
  onPackerChange: (
    mode: "default" | "optimal" | "maxrect",
    spacing?: number,
  ) => Promise<void>;
  onAtlasWidth: (v: number | null) => Promise<void>;
  onAtlasHeight: (v: number | null) => Promise<void>;
  onFixedSize: (v: boolean) => Promise<void>;
  onJsonFormat: (v: JsonFormat) => void;
  onSpacing: (v: number) => Promise<void>;
  onDetectDuplicates: () => void;
  onDeleteDuplicates: (report: DupReport) => Promise<void>;
  onDownload: () => void;
  onDownloadMode: (m: "sprites" | "atlas") => void;
  onFmt: (f: "png" | "jpeg" | "webp") => void;
  onQuality: (q: number) => void;
  onBgMode: (v: "auto" | "alpha" | "key" | "custom") => void;
  onTol: (v: number) => void;
  onProjectName: (v: string) => void;
  onBackground: (v: SpritePackerState["background"]) => void;
  onTheme: (v: "light" | "dark") => void;
  closeSettings: () => void;
  openSettings: () => void;
  closeDupReport: () => void;
};

export type UseSpritePackerReturn = {
  state: SpritePackerState;
  actions: SpritePackerActions;
};

export function useSpritePacker(): UseSpritePackerReturn {
  const detector = useMemo(() => new ComponentDetector(), []);
  useDisablePageZoom();
  const { theme, setTheme, background, setBackground } = useThemePrefs();

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<ComponentBox[]>([]);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  const [originalBoxes, setOriginalBoxes] = useState<ComponentBox[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [fmt, setFmt] = useState<"png" | "jpeg" | "webp">("png");
  const [quality, setQuality] = useState(0.92);
  const [bgMode, setBgMode] = useState<"auto" | "alpha" | "key" | "custom">(
    "auto",
  );
  const [cclTol, setCclTol] = useState(16);
  const [downloadMode, setDownloadMode] = useState<"sprites" | "atlas">(
    "sprites",
  );
  const [projectName, setProjectName] = useState("project");
  const [packerMode, setPackerMode] = useState<
    "default" | "optimal" | "maxrect"
  >("default");
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>("json-array");
  const [spacing, setSpacing] = useState(10);
  const [atlasWidth, setAtlasWidth] = useState<number | null>(2048);
  const [atlasHeight, setAtlasHeight] = useState<number | null>(2048);
  const [fixedSize, setFixedSize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dupReport, setDupReport] = useState<DupReport | null>(null);
  const [customBoxes, setCustomBoxes] = useState<ComponentBox[] | null>(null);

  // initialize bg mode once
  useEffect(() => {
    setBgMode("auto");
  }, []);

  const onSelect = (idx: number | null) =>
    setSelected((prev) => (prev === idx ? null : idx));

  const onMoveBox = (updater: (prev: ComponentBox[]) => ComponentBox[]) => {
    setBoxes((prev) => {
      const next = updater(prev);
      setOriginalBoxes(next);
      return next;
    });
  };

  const addBoxIfNonOverlap = (b: ComponentBox): number | null => {
    let idx: number | null = null;
    setBoxes((prev) => {
      if (prev.some((p) => overlaps(p, b))) return prev;
      idx = prev.length;
      return [...prev, b];
    });
    if (idx != null) {
      setOriginalBoxes((prev) => [...prev, b]);
    }
    return idx;
  };

  const handleFiles = async (files?: FileList) => {
    if (!files || !files.length) return;
    const canvases: {
      canvas: HTMLCanvasElement;
      w: number;
      h: number;
      name?: string;
    }[] = [];
    let firstName = "";
    if (originalImg && originalBoxes.length) {
      originalBoxes.forEach((b, idx) => {
        const c = document.createElement("canvas");
        c.width = b.w;
        c.height = b.h;
        c.getContext("2d")?.drawImage(
          originalImg,
          b.x,
          b.y,
          b.w,
          b.h,
          0,
          0,
          b.w,
          b.h,
        );
        canvases.push({
          canvas: c,
          w: c.width,
          h: c.height,
          name: b.name || `sprite-${idx + 1}`,
        });
      });
    }
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!firstName) firstName = f.name.replace(/\.[^.]+$/, "") || "project";
      const nextImg = await loadImageFromFile(f);
      const c = document.createElement("canvas");
      c.width = nextImg.width;
      c.height = nextImg.height;
      c.getContext("2d")?.drawImage(nextImg, 0, 0);
      canvases.push({
        canvas: c,
        w: c.width,
        h: c.height,
        name: f.name.replace(/\.[^.]+$/, ""),
      });
    }
    const packed = packCanvases(
      canvases,
      spacing,
      packerMode,
      fixedSize ? atlasWidth : null,
      fixedSize ? atlasHeight : null,
    );
    if (packed) {
      setImg(packed.img);
      setOriginalImg(packed.img);
      setBoxes(packed.boxes);
      setOriginalBoxes(packed.boxes);
      if (!fixedSize) {
        setAtlasWidth(packed.img.width);
        setAtlasHeight(packed.img.height);
      }
      if ((!projectName || projectName === "project") && firstName)
        setProjectName(firstName);
      setBgMode("auto");
      setCustomBoxes(null);
      setSelected(null);
    }
  };

  const applyRepack = async (
    mode = packerMode,
    pad = spacing,
    targetW = atlasWidth,
    targetH = atlasHeight,
  ) => {
    const repacked = await repackSprites(
      mode,
      originalImg,
      originalBoxes,
      pad,
      fixedSize ? targetW : null,
      fixedSize ? targetH : null,
    );
    if (repacked) {
      setImg(repacked.img);
      setBoxes(repacked.boxes);
      setSelected(null);
      if (!fixedSize) {
        setAtlasWidth(repacked.img.width);
        setAtlasHeight(repacked.img.height);
      }
    }
  };

  const handleDetect = async () => {
    if (!img) return;
    if (bgMode === "custom") {
      if (!customBoxes || !customBoxes.length) {
        alert("Upload a custom JSON first.");
        return;
      }
      const cleaned = filterNonOverlapping(customBoxes);
      setOriginalBoxes(cleaned);
      setBoxes(cleaned);
      setSelected(null);
      await applyRepack(packerMode, spacing, atlasWidth, atlasHeight);
      return;
    }
    const temp = document.createElement("canvas");
    temp.width = img.width;
    temp.height = img.height;
    const tctx = temp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(img, 0, 0);
    const data = tctx.getImageData(0, 0, img.width, img.height);
    const mode = bgMode;
    const tol = cclTol;
    let mask: Uint8Array;
    if (mode === "alpha") {
      mask = detector.alphaMask(data, 10);
    } else if (mode === "key") {
      const bg = detector.sampleBackground(data);
      mask = detector.colorKeyMask(data, bg, tol);
    } else {
      const hasAlpha = detector.estimateHasAlpha(data);
      if (hasAlpha) mask = detector.alphaMask(data, 10);
      else {
        const bg = detector.sampleBackground(data);
        mask = detector.colorKeyMask(data, bg, tol);
      }
    }
    let comps = detector
      .findComponents(mask, img.width, img.height)
      .map((b, i) => ({ ...b, id: i + 1 }));
    const minDim = Math.min(img.width, img.height);
    const minSide = Math.max(2, Math.floor(minDim * 0.003));
    comps = comps.filter((b) => b.w >= minSide && b.h >= minSide);
    const cleaned = filterNonOverlapping(comps);
    setOriginalBoxes(cleaned);
    setBoxes(cleaned);
    setSelected(null);
    await applyRepack(packerMode, spacing, atlasWidth, atlasHeight);
  };

  const handleCustomJson = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const next = filterNonOverlapping(parseCustomSprites(parsed, jsonFormat));
      if (!next.length) {
        alert("No sprites found in uploaded JSON.");
        return;
      }
      setBoxes(next);
      setOriginalBoxes(next);
      setCustomBoxes(next);
      setSelected(null);
      try {
        await applyRepack(packerMode, spacing, atlasWidth, atlasHeight);
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to read custom JSON. Please check the format.");
    }
  };

  const detectDuplicates = () => {
    if (!img || !boxes.length) return;
    const canvasList: {
      canvas: HTMLCanvasElement;
      name: string;
      idx: number;
    }[] = [];
    boxes.forEach((b, i) => {
      const c = document.createElement("canvas");
      c.width = b.w;
      c.height = b.h;
      c.getContext("2d")?.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      canvasList.push({ canvas: c, name: b.name || `sprite-${i + 1}`, idx: i });
    });
    const map: Record<
      string,
      { hash: string; items: { idx: number; name: string }[] }
    > = {};
    canvasList.forEach((c) => {
      const h = hashCanvas(c.canvas);
      if (!map[h]) map[h] = { hash: h, items: [] };
      map[h].items.push({ idx: c.idx, name: c.name });
    });
    const groups = Object.values(map).filter((g) => g.items.length > 1);
    const count = groups.reduce((s, g) => s + (g.items.length - 1), 0);
    setDupReport({ count, groups });
  };

  const deleteDuplicates = async (report: DupReport) => {
    if (!report || !report.groups.length) return;
    const toRemove = new Set<number>();
    report.groups.forEach((g) => {
      g.items.forEach((item, idx) => {
        if (idx > 0) toRemove.add(item.idx);
      });
    });
    const filteredBoxes = boxes.filter((_, i) => !toRemove.has(i));
    setBoxes(filteredBoxes);
    setOriginalBoxes(filteredBoxes);
    await applyRepackWithBoxes(filteredBoxes);
  };

  const applyRepackWithBoxes = async (nextBoxes: ComponentBox[]) => {
    const repacked = await repackSprites(
      packerMode,
      img,
      nextBoxes,
      spacing,
      fixedSize ? atlasWidth : null,
      fixedSize ? atlasHeight : null,
    );
    if (repacked) {
      setImg(repacked.img);
      setOriginalImg(repacked.img);
      setBoxes(repacked.boxes);
      setOriginalBoxes(repacked.boxes);
      setSelected(null);
      if (!fixedSize) {
        setAtlasWidth(repacked.img.width);
        setAtlasHeight(repacked.img.height);
      }
    }
  };

  const handleDelete = async () => {
    if (selected == null) return;
    const target = boxes[selected];
    setBoxes((prev) => prev.filter((_, i) => i !== selected));
    setOriginalBoxes((prev) => prev.filter((_, i) => i !== selected));
    setSelected(null);
    if (img) {
      const cleared = await clearRegion(img, target);
      setImg(cleared);
    }
    if (originalImg) {
      const cleared = await clearRegion(originalImg, target);
      setOriginalImg(cleared);
    }
  };

  const handleClear = () => {
    setBoxes([]);
    setOriginalBoxes([]);
    setImg(null);
    setOriginalImg(null);
    setAtlasWidth(null);
    setAtlasHeight(null);
    setSelected(null);
  };

  const downloadSpritesZip = async () => {
    if (!img || !boxes.length) return;
    const zip = new JSZip();
    const ordered = orderBoxes(boxes);
    const mime = currentMimeAndExt(fmt);
    const q = mime.lossy ? Math.max(0, Math.min(1, quality)) : undefined;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d")!;
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      tmp.width = b.w;
      tmp.height = b.h;
      tctx.clearRect(0, 0, b.w, b.h);
      tctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const name = (b.name && b.name.trim()) || `sprite-${i + 1}`;
      const blob = await toBlob(tmp, mime.mime, q);
      zip.file(`${name}.${mime.ext === "jpg" ? "jpg" : mime.ext}`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    triggerDownload(content, `${safeProjectName(projectName)}-sprites.zip`);
  };

  const downloadAtlasZip = async () => {
    if (!img || !boxes.length) return;
    const zip = new JSZip();
    const imgCanvas = document.createElement("canvas");
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const ctx = imgCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imgBlob = await toBlob(imgCanvas, "image/png");
    zip.file(`${safeProjectName(projectName)}-atlas.png`, imgBlob);
    const ordered = orderBoxes(boxes);
    const frames = ordered.map((b, i) => ({
      filename: (b.name && b.name.trim()) || `sprite-${i + 1}`,
      frame: { x: b.x, y: b.y, w: b.w, h: b.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: b.w, h: b.h },
      sourceSize: { w: b.w, h: b.h },
    }));
    const meta = {
      app: "{http://spritepacker.app/}",
      version: "SpritePacker v.1.0.0",
      image: `${safeProjectName(projectName)}-atlas.png`,
      size: { w: img.width, h: img.height },
      scale: 1,
    };
    const payload = buildPayloadForFormat(jsonFormat, frames, meta);
    zip.file("sprites.json", JSON.stringify(payload, null, 2));
    const content = await zip.generateAsync({ type: "blob" });
    triggerDownload(content, `${safeProjectName(projectName)}-atlas.zip`);
  };

  const handlePackerChange = async (
    mode: "default" | "optimal" | "maxrect",
    pad = spacing,
  ) => {
    setPackerMode(mode);
    await applyRepack(mode, pad, atlasWidth, atlasHeight);
  };

  const onAtlasWidthChange = async (v: number | null) => {
    setAtlasWidth(v);
    await applyRepack(packerMode, spacing, v, atlasHeight);
  };
  const onAtlasHeightChange = async (v: number | null) => {
    setAtlasHeight(v);
    await applyRepack(packerMode, spacing, atlasWidth, v);
  };
  const onFixedSizeChange = async (v: boolean) => {
    setFixedSize(v);
    await applyRepack(packerMode, spacing, atlasWidth, atlasHeight);
  };

  const selectedBox = selected != null ? boxes[selected] : null;

  const state: SpritePackerState = {
    img,
    boxes,
    selected,
    selectedBox,
    projectName,
    packerMode,
    jsonFormat,
    spacing,
    atlasWidth,
    atlasHeight,
    fixedSize,
    downloadMode,
    fmt,
    quality,
    bgMode,
    cclTol,
    background,
    theme,
    showSettings,
    dupReport,
  };

  const actions: SpritePackerActions = {
    onFiles: handleFiles,
    onDetect: handleDetect,
    onCustomJson: handleCustomJson,
    onSelect,
    onMoveBox,
    onAddBox: addBoxIfNonOverlap,
    onDeleteSelected: handleDelete,
    onClearAll: handleClear,
    onUpdateSelected: (next) => {
      if (selected == null || !selectedBox) return;
      setBoxes((prev) =>
        prev.map((b, i) => (i === selected ? { ...b, ...next } : b)),
      );
      setOriginalBoxes((prev) =>
        prev.map((b, i) => (i === selected ? { ...b, ...next } : b)),
      );
    },
    onPackerChange: handlePackerChange,
    onAtlasWidth: onAtlasWidthChange,
    onAtlasHeight: onAtlasHeightChange,
    onFixedSize: onFixedSizeChange,
    onJsonFormat: setJsonFormat,
    onSpacing: async (v: number) => {
      const next = Number.isNaN(v) ? 5 : Math.max(5, v);
      setSpacing(next);
      await handlePackerChange(packerMode, next);
    },
    onDetectDuplicates: detectDuplicates,
    onDeleteDuplicates: deleteDuplicates,
    onDownload: () => {
      if (downloadMode === "sprites") downloadSpritesZip();
      else downloadAtlasZip();
    },
    onDownloadMode: setDownloadMode,
    onFmt: setFmt,
    onQuality: setQuality,
    onBgMode: setBgMode,
    onTol: setCclTol,
    onProjectName: setProjectName,
    onBackground: setBackground,
    onTheme: setTheme,
    closeSettings: () => setShowSettings(false),
    openSettings: () => setShowSettings(true),
    closeDupReport: () => setDupReport(null),
  };

  return { state, actions };
}

function toHash(
  frames: {
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }[],
) {
  const obj: Record<string, any> = {};
  frames.forEach((f) => {
    obj[f.filename] = f;
  });
  return obj;
}

function parseCustomSprites(data: any, format: JsonFormat): ComponentBox[] {
  if (format === "json-array") {
    const frames = Array.isArray(data) ? data : data?.frames;
    if (!Array.isArray(frames)) return [];
    return frames
      .filter((e) => e && e.frame)
      .map((e, i) => ({
        id: e.id ?? i + 1,
        name: e.filename ?? e.name,
        x: e.frame.x ?? 0,
        y: e.frame.y ?? 0,
        w: e.frame.w ?? 0,
        h: e.frame.h ?? 0,
      }))
      .filter((b) => b.w > 0 && b.h > 0);
  }
  if (
    format === "json-hash" ||
    format === "pixi" ||
    format === "phaser-hash" ||
    format === "phaser3"
  ) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    const frames = data.frames || data;
    return Object.keys(frames || {})
      .map((key, idx) => {
        const e = frames[key];
        const frame = e.frame || e;
        return {
          id: e.id ?? idx + 1,
          name: key,
          x: frame.x ?? 0,
          y: frame.y ?? 0,
          w: frame.w ?? 0,
          h: frame.h ?? 0,
        };
      })
      .filter((b) => b.w > 0 && b.h > 0);
  }
  if (format === "phaser-array") {
    const frames = Array.isArray(data?.frames)
      ? data.frames
      : Array.isArray(data)
        ? data
        : null;
    if (!frames) return [];
    return frames
      .map((e: any, idx: number) => ({
        id: e.id ?? idx + 1,
        name: e.filename ?? e.name ?? `sprite-${idx + 1}`,
        x: e.frame?.x ?? e.x ?? 0,
        y: e.frame?.y ?? e.y ?? 0,
        w: e.frame?.w ?? e.w ?? 0,
        h: e.frame?.h ?? e.h ?? 0,
      }))
      .filter((b) => b.w > 0 && b.h > 0);
  }
  return [];
}

async function clearRegion(
  img: HTMLImageElement,
  box: ComponentBox,
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.clearRect(box.x, box.y, box.w, box.h);
  const url = canvas.toDataURL("image/png");
  return new Promise((resolve, reject) => {
    const n = new Image();
    n.onload = () => resolve(n);
    n.onerror = (e) => reject(e);
    n.src = url;
  });
}

function packCanvases(
  items: { canvas: HTMLCanvasElement; w: number; h: number; name?: string }[],
  spacing: number,
  mode: "default" | "optimal" | "maxrect",
  targetW?: number | null,
  targetH?: number | null,
): { img: HTMLImageElement; boxes: ComponentBox[] } | null {
  if (!items.length) return null;
  const pad = Math.max(5, spacing);
  const totalArea = items.reduce((s, b) => s + b.w * b.h, 0);
  const minWidth = Math.max(...items.map((b) => b.w));
  const sqrtW = Math.floor(Math.sqrt(totalArea));
  const candidates = new Set<number>([
    minWidth,
    Math.max(minWidth, sqrtW),
    Math.max(minWidth, sqrtW + pad),
    Math.max(minWidth, sqrtW - pad),
  ]);
  if (targetW && targetW > 0) candidates.add(Math.max(minWidth, targetW));
  let best: {
    placements: {
      x: number;
      y: number;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    }[];
    w: number;
    h: number;
  } | null = null;
  for (const cand of candidates) {
    const width = cand;
    let x = 0;
    let y = 0;
    let rowH = 0;
    let maxRowW = 0;
    const placements: {
      x: number;
      y: number;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    }[] = [];
    const ordered = [...items].sort((a, b) => {
      if (mode === "optimal") return b.h - a.h || b.w - a.w;
      if (mode === "maxrect") return b.w * b.h > a.w * a.h ? -1 : 1;
      return 0;
    });
    for (const b of ordered) {
      if (x > 0 && x + b.w + pad > width) {
        x = 0;
        y += rowH + pad;
        rowH = 0;
      }
      placements.push({ ...b, x, y });
      x += b.w + pad;
      rowH = Math.max(rowH, b.h);
      maxRowW = Math.max(maxRowW, x - pad);
    }
    const h = y + rowH;
    const w = Math.max(width, maxRowW);
    if (
      !best ||
      Math.abs(w - h) < Math.abs(best.w - best.h) ||
      (Math.abs(w - h) === Math.abs(best.w - best.h) && w * h < best.w * best.h)
    ) {
      best = { placements, w, h };
    }
  }
  if (!best) return null;
  const atlasW = targetW && targetW > 0 ? Math.max(best.w, targetW) : best.w;
  const atlasH = targetH && targetH > 0 ? Math.max(best.h, targetH) : best.h;
  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  best.placements.forEach((p) => {
    ctx.drawImage(p.canvas, p.x, p.y, p.w, p.h);
  });
  const outImg = new Image();
  outImg.src = canvas.toDataURL("image/png");
  const outBoxes = best.placements.map((p, i) => ({
    id: i + 1,
    name: (p as any).name || `sprite-${i + 1}`,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
  }));
  return { img: outImg, boxes: outBoxes };
}

function hashCanvas(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return hashBytes(data);
}

function buildPayloadForFormat(
  format: JsonFormat,
  frames: {
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }[],
  meta: any,
) {
  switch (format) {
    case "json-array":
    case "phaser-array":
      return { frames, meta };
    case "json-hash":
    case "pixi":
    case "phaser-hash":
    case "phaser3":
    default:
      return { frames: toHash(frames), meta };
  }
}
