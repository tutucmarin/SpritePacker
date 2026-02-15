import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ComponentDetector } from "@/src/lib/component-detector";
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
  | "phaser3"
  | "unity"
  | "tpsheet";

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
  archive: boolean;
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
  onUpdateSelected: (
    next: ComponentBox,
    applyToImage?: boolean,
  ) => Promise<void>;
  onReplaceSelected: (file: File) => Promise<void>;
  onFitSelected: () => Promise<void>;
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
  onArchive: (v: boolean) => void;
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
  const [archive, setArchive] = useState(true);
  const [bgMode, setBgMode] = useState<"auto" | "alpha" | "key" | "custom">(
    "auto",
  );
  const [cclTol, setCclTol] = useState(16);
  const [downloadMode, setDownloadMode] = useState<"sprites" | "atlas">(
    "atlas",
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

  const detectBoxesFromImage = (
    sourceImg: HTMLImageElement,
    mode: "auto" | "alpha" | "key" | "custom",
    tol: number,
  ): ComponentBox[] => {
    const temp = document.createElement("canvas");
    temp.width = sourceImg.width;
    temp.height = sourceImg.height;
    const tctx = temp.getContext("2d");
    if (!tctx) return [];
    tctx.drawImage(sourceImg, 0, 0);
    const data = tctx.getImageData(0, 0, sourceImg.width, sourceImg.height);

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
      .findComponents(mask, sourceImg.width, sourceImg.height)
      .map((b, i) => ({ ...b, id: i + 1 }));
    const minDim = Math.min(sourceImg.width, sourceImg.height);
    const minSide = Math.max(2, Math.floor(minDim * 0.003));
    comps = comps.filter((b) => b.w >= minSide && b.h >= minSide);
    return filterNonOverlapping(comps);
  };

  const detectAndRepackForMode = async (nextPackerMode = packerMode) => {
    const sourceImg = originalImg ?? img;
    if (!sourceImg) return;

    let mode = bgMode;
    let detected: ComponentBox[];
    if (mode === "custom") {
      if (customBoxes && customBoxes.length) {
        detected = filterNonOverlapping(customBoxes);
      } else {
        mode = "auto";
        setBgMode("auto");
        detected = detectBoxesFromImage(sourceImg, mode, cclTol);
      }
    } else {
      detected = detectBoxesFromImage(sourceImg, mode, cclTol);
    }

    if (!detected.length) {
      alert("No sprites detected.");
      return;
    }

    const repacked = await repackSprites(
      nextPackerMode,
      sourceImg,
      detected,
      spacing,
      fixedSize ? atlasWidth : null,
      fixedSize ? atlasHeight : null,
    );
    if (!repacked) return;

    setOriginalImg(sourceImg);
    setOriginalBoxes(detected);
    setImg(repacked.img);
    setBoxes(repacked.boxes);
    setSelected(null);
    if (!fixedSize) {
      setAtlasWidth(repacked.img.width);
      setAtlasHeight(repacked.img.height);
    }
  };

  const handleDetect = async () => {
    await detectAndRepackForMode(packerMode);
  };

  const handleCustomJson = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const next =
        jsonFormat === "unity"
          ? filterNonOverlapping(parseUnityAtlas(text))
          : filterNonOverlapping(
              parseCustomSprites(JSON.parse(text), jsonFormat),
            );
      if (!next.length) {
        alert("No sprites found in uploaded file.");
        return;
      }
      setBoxes(next);
      setOriginalBoxes(next);
      setCustomBoxes(next);
      setSelected(null);
      try {
        await applyRepackWithBoxes(next);
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to read custom data. Please check the format.");
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

  const handleReplaceSelected = async (file: File) => {
    if (selected == null || !boxes.length) return;
    const target = boxes[selected];
    const nextImg = await loadImageFromFile(file);
    const closeWidth = Math.abs(nextImg.width - target.w) <= 1;
    const closeHeight = Math.abs(nextImg.height - target.h) <= 1;
    if (!closeWidth && !closeHeight) {
      alert(
        `Replacement must match current sprite width or height (±1px). Current ${target.w}x${target.h}, new ${nextImg.width}x${nextImg.height}.`,
      );
      return;
    }
    if (
      target.x + nextImg.width > (img?.width ?? 0) ||
      target.y + nextImg.height > (img?.height ?? 0)
    ) {
      alert("Replacement image does not fit inside the atlas bounds.");
      return;
    }

    const redrawWithReplacement = async (
      base: HTMLImageElement | null,
    ): Promise<HTMLImageElement | null> => {
      if (!base) return null;
      const c = document.createElement("canvas");
      c.width = base.width;
      c.height = base.height;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(base, 0, 0);
      ctx.clearRect(target.x, target.y, target.w, target.h);
      ctx.drawImage(nextImg, target.x, target.y, nextImg.width, nextImg.height);
      return await imageFromCanvas(c);
    };

    const [nextAtlas, nextOriginal] = await Promise.all([
      redrawWithReplacement(img),
      redrawWithReplacement(originalImg),
    ]);

    if (nextAtlas) setImg(nextAtlas);
    if (nextOriginal) setOriginalImg(nextOriginal);

    const updated = boxes.map((b, i) =>
      i === selected ? { ...b, w: nextImg.width, h: nextImg.height } : b,
    );
    setBoxes(updated);
    setOriginalBoxes((prev) =>
      prev.map((b, i) =>
        i === selected ? { ...b, w: nextImg.width, h: nextImg.height } : b,
      ),
    );
    setCustomBoxes((prev) =>
      prev
        ? prev.map((b, i) =>
            i === selected ? { ...b, w: nextImg.width, h: nextImg.height } : b,
          )
        : prev,
    );
  };

  const handleFitSelected = async () => {
    if (selected == null || !boxes.length || !img) return;
    const target = boxes[selected];
    const fitted = detectFittedBoundsForBox(
      img,
      target,
      detector,
      bgMode,
      cclTol,
    );
    if (!fitted) {
      alert("Could not detect sprite bounds for Fit.");
      return;
    }
    const nextBox: ComponentBox = { ...target, ...fitted };
    if (!isBoxInsideImage(nextBox, img)) {
      alert("Fitted sprite bounds must stay inside the atlas image.");
      return;
    }
    if (originalImg && !isBoxInsideImage(nextBox, originalImg)) {
      alert("Fitted sprite bounds must stay inside the atlas image.");
      return;
    }

    setBoxes((prev) => prev.map((b, i) => (i === selected ? nextBox : b)));
    setOriginalBoxes((prev) =>
      prev.map((b, i) => (i === selected ? nextBox : b)),
    );
    setCustomBoxes((prev) =>
      prev ? prev.map((b, i) => (i === selected ? nextBox : b)) : prev,
    );
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
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d")!;
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      tmp.width = b.w;
      tmp.height = b.h;
      tctx.clearRect(0, 0, b.w, b.h);
      tctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const name = (b.name && b.name.trim()) || `sprite-${i + 1}`;
      const blob = await toBlob(tmp, "image/png");
      zip.file(`${name}.png`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    triggerDownload(content, `${safeProjectName(projectName)}-sprites.zip`);
  };

  const downloadSpritesFiles = async () => {
    if (!img || !boxes.length) return;
    const ordered = orderBoxes(boxes);
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d")!;
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      tmp.width = b.w;
      tmp.height = b.h;
      tctx.clearRect(0, 0, b.w, b.h);
      tctx.drawImage(img, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const name = (b.name && b.name.trim()) || `sprite-${i + 1}`;
      const blob = await toBlob(tmp, "image/png");
      triggerDownload(blob, `${name}.png`);
    }
  };

  const buildAtlasArtifacts = async () => {
    if (!img || !boxes.length) return null;
    const baseName = safeProjectName(projectName);
    const imageName = `${baseName}.png`;
    const imgCanvas = document.createElement("canvas");
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const ctx = imgCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imageBlob = await toBlob(imgCanvas, "image/png");
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
      image: imageName,
      size: { w: img.width, h: img.height },
      scale: 1,
    };
    if (jsonFormat === "unity") {
      const dataName = `${baseName}.atlas`;
      const dataBlob = new Blob([buildUnityAtlas(frames, meta)], {
        type: "text/plain;charset=utf-8",
      });
      return { baseName, imageName, imageBlob, dataName, dataBlob };
    }
    const payload = buildPayloadForFormat(jsonFormat, frames, meta);
    const ext = jsonFormat === "tpsheet" ? "tpsheet" : "json";
    const dataName = `${baseName}.${ext}`;
    const dataBlob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    return { baseName, imageName, imageBlob, dataName, dataBlob };
  };

  const downloadAtlasZip = async () => {
    const artifacts = await buildAtlasArtifacts();
    if (!artifacts) return;
    const { baseName, imageName, imageBlob, dataName, dataBlob } = artifacts;
    const zip = new JSZip();
    zip.file(imageName, imageBlob);
    zip.file(dataName, dataBlob);
    const content = await zip.generateAsync({ type: "blob" });
    triggerDownload(content, `${baseName}.zip`);
  };

  const downloadAtlasFiles = async () => {
    const artifacts = await buildAtlasArtifacts();
    if (!artifacts) return;
    const { imageName, imageBlob, dataName, dataBlob } = artifacts;
    triggerDownload(imageBlob, imageName);
    setTimeout(() => {
      triggerDownload(dataBlob, dataName);
    }, 60);
  };

  const handlePackerChange = async (
    mode: "default" | "optimal" | "maxrect",
    pad = spacing,
  ) => {
    setPackerMode(mode);
    if (pad !== spacing) {
      await applyRepack(mode, pad, atlasWidth, atlasHeight);
      return;
    }
    await detectAndRepackForMode(mode);
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
    archive,
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
    onUpdateSelected: async (next, applyToImage = false) => {
      if (selected == null || !selectedBox) return;
      const nextBox: ComponentBox = { ...selectedBox, ...next };
      const geometryChanged =
        selectedBox.x !== nextBox.x ||
        selectedBox.y !== nextBox.y ||
        selectedBox.w !== nextBox.w ||
        selectedBox.h !== nextBox.h;

      if (applyToImage && geometryChanged) {
        if (img && !isBoxInsideImage(nextBox, img)) {
          alert("Updated sprite bounds must stay inside the atlas image.");
          return;
        }
        if (originalImg && !isBoxInsideImage(nextBox, originalImg)) {
          alert("Updated sprite bounds must stay inside the atlas image.");
          return;
        }

        const [nextAtlas, nextOriginal] = await Promise.all([
          img
            ? transformImageRegion(img, selectedBox, nextBox)
            : Promise.resolve(null),
          originalImg
            ? transformImageRegion(originalImg, selectedBox, nextBox)
            : Promise.resolve(null),
        ]);

        if (img && !nextAtlas) {
          alert("Could not apply sprite changes to atlas image.");
          return;
        }
        if (originalImg && !nextOriginal) {
          alert("Could not apply sprite changes to source image.");
          return;
        }
        if (nextAtlas) setImg(nextAtlas);
        if (nextOriginal) setOriginalImg(nextOriginal);
      }

      setBoxes((prev) =>
        prev.map((b, i) => (i === selected ? { ...b, ...nextBox } : b)),
      );
      setOriginalBoxes((prev) =>
        prev.map((b, i) => (i === selected ? { ...b, ...nextBox } : b)),
      );
      setCustomBoxes((prev) =>
        prev
          ? prev.map((b, i) => (i === selected ? { ...b, ...nextBox } : b))
          : prev,
      );
    },
    onReplaceSelected: handleReplaceSelected,
    onFitSelected: handleFitSelected,
    onPackerChange: handlePackerChange,
    onAtlasWidth: onAtlasWidthChange,
    onAtlasHeight: onAtlasHeightChange,
    onFixedSize: onFixedSizeChange,
    onJsonFormat: setJsonFormat,
    onSpacing: async (v: number) => {
      const next = Number.isNaN(v) ? 5 : Math.max(5, v);
      setSpacing(next);
      await applyRepack(packerMode, next, atlasWidth, atlasHeight);
    },
    onDetectDuplicates: detectDuplicates,
    onDeleteDuplicates: deleteDuplicates,
    onDownload: () => {
      if (downloadMode === "sprites") {
        if (archive) downloadSpritesZip();
        else downloadSpritesFiles();
      } else if (archive) {
        downloadAtlasZip();
      } else {
        downloadAtlasFiles();
      }
    },
    onDownloadMode: setDownloadMode,
    onArchive: setArchive,
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

function parseUnityAtlas(text: string): ComponentBox[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const boxes: ComponentBox[] = [];
  let pageSeen = false;
  let current: {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;

  const flush = () => {
    if (current && current.w > 0 && current.h > 0) {
      boxes.push({
        id: boxes.length + 1,
        name: current.name,
        x: current.x,
        y: current.y,
        w: current.w,
        h: current.h,
      });
    }
  };

  for (const raw of lines) {
    const isIndented = raw.startsWith(" ") || raw.startsWith("\t");
    const line = raw.trim();
    if (!line) continue;

    if (!isIndented) {
      if (!pageSeen) {
        pageSeen = true;
        continue;
      }
      flush();
      current = { name: line, x: 0, y: 0, w: 0, h: 0 };
      continue;
    }

    if (!current) continue;
    const [key, value] = line.split(":").map((s) => s.trim());
    if (!key || !value) continue;
    if (key === "xy") {
      const [x, y] = value.split(",").map((n) => parseInt(n.trim(), 10) || 0);
      current.x = x;
      current.y = y;
    } else if (key === "size") {
      const [w, h] = value.split(",").map((n) => parseInt(n.trim(), 10) || 0);
      current.w = w;
      current.h = h;
    }
  }
  flush();
  return boxes;
}

function parseCustomSprites(data: any, format: JsonFormat): ComponentBox[] {
  if (format === "json-array" || format === "tpsheet") {
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

function detectFittedBoundsForBox(
  img: HTMLImageElement,
  target: ComponentBox,
  detector: ComponentDetector,
  mode: "auto" | "alpha" | "key" | "custom",
  tol: number,
): Pick<ComponentBox, "x" | "y" | "w" | "h"> | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);

  let mask: Uint8Array;
  if (mode === "alpha") {
    mask = detector.alphaMask(data, 10);
  } else if (mode === "key") {
    const bg = detector.sampleBackground(data);
    mask = detector.colorKeyMask(data, bg, tol);
  } else {
    const hasAlpha = detector.estimateHasAlpha(data);
    if (hasAlpha) {
      mask = detector.alphaMask(data, 10);
    } else {
      const bg = detector.sampleBackground(data);
      mask = detector.colorKeyMask(data, bg, tol);
    }
  }

  const components = detector.findComponents(mask, img.width, img.height);
  if (!components.length) return null;

  let best: ComponentBox | null = null;
  let bestOverlap = 0;
  let bestCenterDist = Infinity;
  const centerX = target.x + target.w / 2;
  const centerY = target.y + target.h / 2;

  for (const comp of components) {
    const overlap = intersectionArea(target, comp);
    if (overlap <= 0) continue;
    const compCenterX = comp.x + comp.w / 2;
    const compCenterY = comp.y + comp.h / 2;
    const centerDist =
      (compCenterX - centerX) * (compCenterX - centerX) +
      (compCenterY - centerY) * (compCenterY - centerY);
    if (
      !best ||
      overlap > bestOverlap ||
      (overlap === bestOverlap && centerDist < bestCenterDist)
    ) {
      best = comp;
      bestOverlap = overlap;
      bestCenterDist = centerDist;
    }
  }

  if (!best) return null;
  return { x: best.x, y: best.y, w: best.w, h: best.h };
}

function intersectionArea(a: ComponentBox, b: ComponentBox): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
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
  return imageFromDataUrl(url);
}

function isBoxInsideImage(box: ComponentBox, img: HTMLImageElement): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.w > 0 &&
    box.h > 0 &&
    box.x + box.w <= img.width &&
    box.y + box.h <= img.height
  );
}

async function transformImageRegion(
  img: HTMLImageElement,
  from: ComponentBox,
  to: ComponentBox,
): Promise<HTMLImageElement | null> {
  if (!isBoxInsideImage(from, img) || !isBoxInsideImage(to, img)) return null;

  const source = document.createElement("canvas");
  source.width = from.w;
  source.height = from.h;
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx) return null;
  sourceCtx.drawImage(
    img,
    from.x,
    from.y,
    from.w,
    from.h,
    0,
    0,
    from.w,
    from.h,
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  ctx.clearRect(from.x, from.y, from.w, from.h);
  ctx.drawImage(source, 0, 0, from.w, from.h, to.x, to.y, to.w, to.h);

  return await imageFromCanvas(canvas);
}

async function imageFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<HTMLImageElement> {
  const url = canvas.toDataURL("image/png");
  return imageFromDataUrl(url);
}

function imageFromDataUrl(url: string): Promise<HTMLImageElement> {
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

function buildUnityAtlas(
  frames: {
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }[],
  meta: { image: string },
) {
  const lines: string[] = [
    meta.image,
    "format: RGBA8888",
    "filter: Nearest,Nearest",
    "repeat: none",
  ];

  frames.forEach((f) => {
    lines.push(f.filename);
    lines.push("  rotate: false");
    lines.push(`  xy: ${f.frame.x}, ${f.frame.y}`);
    lines.push(`  size: ${f.frame.w}, ${f.frame.h}`);
    lines.push(`  orig: ${f.sourceSize.w}, ${f.sourceSize.h}`);
    lines.push("  offset: 0, 0");
    lines.push("  index: -1");
  });

  return lines.join("\n");
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
    case "tpsheet":
      return { frames, meta };
    case "json-hash":
    case "pixi":
    case "phaser-hash":
    case "phaser3":
    case "unity":
    default:
      return { frames: toHash(frames), meta };
  }
}
