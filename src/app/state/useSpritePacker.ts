import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { ComponentDetector } from "@/src/lib/component-detector";
import type { ComponentBox } from "@/src/lib/types";
import {
  loadImageFromFile,
  loadImageFromCanvas,
  toBlob,
  triggerDownload,
  safeProjectName,
} from "@/src/lib/image-utils";
import { repackSprites } from "@/src/lib/packing";
import { findOptimalShelfPacking } from "@/src/lib/optimal-packing";
import { useDisablePageZoom } from "@/src/hooks/useDisablePageZoom";
import { useThemePrefs, BackgroundMode } from "@/src/app/state/useThemePrefs";
import {
  filterNonOverlapping,
  orderBoxes,
  overlaps,
} from "@/src/lib/box-utils";
import { hashBytes } from "@/src/lib/hash";
import {
  atlasFormatFromFile,
  atlasFormatInfo,
  type AtlasImageFormat,
} from "@/src/lib/atlas-format";

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

type ClipboardSprite = {
  box: ComponentBox;
  canvas: HTMLCanvasElement;
};

type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type FilePickerOptions = {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
};

type FilePickerWindow = Window & {
  showOpenFilePicker?: (
    options?: FilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
};

type SpritePackerState = {
  img: HTMLImageElement | null;
  boxes: ComponentBox[];
  selected: number[];
  projectName: string;
  packerMode: "default" | "optimal" | "maxrect";
  jsonFormat: JsonFormat;
  spacing: number;
  atlasWidth: number | null;
  atlasHeight: number | null;
  fixedSize: boolean;
  autoSize: boolean;
  atlasScale: number;
  downloadMode: "sprites" | "atlas";
  atlasImageFormat: AtlasImageFormat;
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
  onFiles: (files?: File[]) => Promise<void>;
  onLoadAtlas: (files?: File[]) => Promise<void>;
  onDetect: () => Promise<void>;
  onCustomJson: (file?: File) => Promise<void>;
  onSelect: (idx: number | null, additive?: boolean) => void;
  onSelectMany: (indices: number[], additive?: boolean) => void;
  onMoveBox: (updater: (prev: ComponentBox[]) => ComponentBox[]) => void;
  onCopySelected: () => Promise<void>;
  onPasteSelected: (files: File[]) => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  onClearAll: () => void;
  onUpdateSelected: (
    next: ComponentBox,
    applyToImage?: boolean,
  ) => Promise<void>;
  onReplaceSelected: (file: File) => Promise<void>;
  onFitSelected: () => Promise<void>;
  onRotateSelected: (direction: "left" | "right") => Promise<void>;
  onPackerChange: (
    mode: "default" | "optimal" | "maxrect",
    spacing?: number,
  ) => Promise<void>;
  onAtlasWidth: (v: number | null) => Promise<void>;
  onAtlasHeight: (v: number | null) => Promise<void>;
  onFixedSize: (v: boolean) => Promise<void>;
  onAutoSize: (v: boolean) => Promise<void>;
  onAtlasScale: (v: number) => Promise<void>;
  onJsonFormat: (v: JsonFormat) => void;
  onSpacing: (v: number) => Promise<void>;
  onDetectDuplicates: () => void;
  onDeleteDuplicates: (report: DupReport) => Promise<void>;
  onDownload: () => void;
  onDownloadMode: (m: "sprites" | "atlas") => void;
  onAtlasImageFormat: (format: AtlasImageFormat) => void;
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
  const [selected, setSelected] = useState<number[]>([]);
  const [archive, setArchive] = useState(true);
  const [bgMode, setBgMode] = useState<"auto" | "alpha" | "key" | "custom">(
    "auto",
  );
  const [cclTol, setCclTol] = useState(16);
  const [downloadMode, setDownloadMode] = useState<"sprites" | "atlas">(
    "atlas",
  );
  const [atlasImageFormat, setAtlasImageFormat] = useState<AtlasImageFormat>("png");
  const [projectName, setProjectName] = useState("project");
  const [packerMode, setPackerMode] = useState<
    "default" | "optimal" | "maxrect"
  >("default");
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>("json-array");
  const [spacing, setSpacing] = useState(10);
  const [atlasWidth, setAtlasWidth] = useState<number | null>(null);
  const [atlasHeight, setAtlasHeight] = useState<number | null>(null);
  const [fixedSize, setFixedSize] = useState(false);
  const [atlasScale, setAtlasScale] = useState(100);
  const atlasScaleRef = useRef(100);
  const [showSettings, setShowSettings] = useState(false);
  const [dupReport, setDupReport] = useState<DupReport | null>(null);
  const [customBoxes, setCustomBoxes] = useState<ComponentBox[] | null>(null);
  const renderRevision = useRef(0);
  const commitRevision = useRef(0);
  const clipboardRef = useRef<ClipboardSprite[]>([]);
  const clipboardBlobRef = useRef<Blob | null>(null);
  const pasteInProgressRef = useRef(false);

  const renderScaledAtlas = async (
    sourceImg: HTMLImageElement,
    sourceBoxes: ComponentBox[],
    scalePercent = atlasScaleRef.current,
  ) => {
    const revision = ++renderRevision.current;
    const scale = clampAtlasScale(scalePercent) / 100;
    const scaledBoxes = sourceBoxes.map((box) => scaleBox(box, scale));
    let rendered = sourceImg;

    if (scale !== 1) {
      const canvas = document.createElement("canvas");
      const contentWidth = scaledBoxes.reduce(
        (max, box) => Math.max(max, box.x + box.w),
        1,
      );
      const contentHeight = scaledBoxes.reduce(
        (max, box) => Math.max(max, box.y + box.h),
        1,
      );
      canvas.width = Math.max(contentWidth, Math.round(sourceImg.width * scale));
      canvas.height = Math.max(contentHeight, Math.round(sourceImg.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height);
      rendered = await loadImageFromCanvas(canvas);
      canvas.width = 0;
      canvas.height = 0;
    }

    if (revision !== renderRevision.current) return;
    setImg(rendered);
    setBoxes(scaledBoxes);
    setAtlasWidth(rendered.width);
    setAtlasHeight(rendered.height);
  };

  const commitCanonicalAtlas = async (
    sourceImg: HTMLImageElement,
    sourceBoxes: ComponentBox[],
    options: {
      mode?: "default" | "optimal" | "maxrect";
      pad?: number;
      fixed?: boolean;
      targetW?: number | null;
      targetH?: number | null;
      rotate?: { indices: number[]; direction: "left" | "right" };
      scalePercent?: number;
      clearSelection?: boolean;
    } = {},
  ) => {
    const revision = ++commitRevision.current;
    if (!sourceBoxes.length) {
      setOriginalImg(sourceImg);
      setOriginalBoxes([]);
      setImg(null);
      setBoxes([]);
      setAtlasWidth(null);
      setAtlasHeight(null);
      if (options.clearSelection !== false) setSelected([]);
      return;
    }

    const useFixed = options.fixed ?? fixedSize;
    const repacked = await repackSprites(
      options.mode ?? packerMode,
      sourceImg,
      sourceBoxes,
      options.pad ?? spacing,
      useFixed ? options.targetW ?? sourceImg.width : null,
      useFixed ? options.targetH ?? sourceImg.height : null,
      {
        compact: !useFixed,
        rotate: options.rotate,
      },
    );
    if (!repacked) return;
    if (revision !== commitRevision.current) return;

    setOriginalImg(repacked.img);
    setOriginalBoxes(repacked.boxes);
    if (options.clearSelection !== false) setSelected([]);
    await renderScaledAtlas(
      repacked.img,
      repacked.boxes,
      options.scalePercent ?? atlasScaleRef.current,
    );
  };

  // initialize bg mode once
  useEffect(() => {
    setBgMode("auto");
  }, []);

  const onSelect = (idx: number | null, additive = false) => {
    if (idx == null) {
      setSelected([]);
      return;
    }
    setSelected((previous) => {
      if (!additive) return [idx];
      return previous.includes(idx)
        ? previous.filter((value) => value !== idx)
        : [...previous, idx];
    });
  };

  const onSelectMany = (indices: number[], additive = false) => {
    const valid = [...new Set(indices)].filter(
      (index) => index >= 0 && index < boxes.length,
    );
    setSelected((previous) =>
      additive ? [...new Set([...previous, ...valid])] : valid,
    );
  };

  const onMoveBox = (updater: (prev: ComponentBox[]) => ComponentBox[]) => {
    setBoxes((prev) => {
      const next = updater(prev);
      if (boxesOverlap(next)) return prev;
      setOriginalBoxes((current) =>
        next.map((box, index) => {
          const original = current[index];
          if (!original) return unscaleBox(box, atlasScale / 100);
          const scale = atlasScale / 100;
          return {
            ...original,
            name: box.name,
            x: Math.max(
              0,
              Math.min(
                (originalImg?.width ?? Infinity) - original.w,
                Math.round(box.x / scale),
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                (originalImg?.height ?? Infinity) - original.h,
                Math.round(box.y / scale),
              ),
            ),
          };
        }),
      );
      return next;
    });
  };

  const importFiles = async (files?: File[]) => {
    if (!files || !files.length) return;

    // A custom atlas description may be selected before its image. In that
    // case the single image is the atlas itself, not a sprite to be packed.
    if (!originalImg && customBoxes?.length && files.length === 1) {
      const file = files[0];
      let atlas: HTMLImageElement;
      try {
        atlas = await loadImageFromFile(file);
      } catch (error) {
        console.error(error);
        alert(imageLoadErrorMessage(file, error));
        return;
      }
      if (customBoxes.some((box) => !isBoxInsideImage(box, atlas))) {
        alert("Custom sprite bounds must stay inside the atlas image.");
        return;
      }
      setAtlasImageFormat(atlasFormatFromFile(file));
      setOriginalImg(atlas);
      setOriginalBoxes(customBoxes);
      await renderScaledAtlas(atlas, customBoxes);
      const name = file.name.replace(/\.[^.]+$/, "").trim();
      if ((!projectName || projectName === "project") && name) {
        setProjectName(name);
      }
      setSelected([]);
      return;
    }

    const canvases: {
      canvas: HTMLCanvasElement;
      w: number;
      h: number;
      name?: string;
    }[] = [];
    let firstName = "";
    let firstFormat: AtlasImageFormat | null = null;
    let accepted = 0;
    const rejected: { file: File; error: unknown }[] = [];
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
      const name = f.name.replace(/\.[^.]+$/, "").trim() || `sprite-${i + 1}`;
      const duplicate = canvases.findIndex(
        (item) => spriteNameKey(item.name || "") === spriteNameKey(name),
      );
      if (duplicate >= 0 && !confirm(`A sprite named "${name}" already exists. Replace it?`))
        continue;
      let nextImg: HTMLImageElement;
      try {
        nextImg = await loadImageFromFile(f);
      } catch (error) {
        console.error(error);
        rejected.push({ file: f, error });
        continue;
      }
      if (!firstName) firstName = name;
      if (!firstFormat) firstFormat = atlasFormatFromFile(f);
      const c = document.createElement("canvas");
      c.width = nextImg.width;
      c.height = nextImg.height;
      c.getContext("2d")?.drawImage(nextImg, 0, 0);
      const item = {
        canvas: c,
        w: c.width,
        h: c.height,
        name,
      };
      if (duplicate >= 0) {
        canvases[duplicate].canvas.width = 0;
        canvases[duplicate].canvas.height = 0;
        canvases[duplicate] = item;
      } else {
        canvases.push(item);
      }
      accepted++;
    }
    if (!accepted) {
      canvases.forEach((item) => {
        item.canvas.width = 0;
        item.canvas.height = 0;
      });
      if (rejected.length) alert(imageLoadErrorsMessage(rejected));
      return;
    }
    let packed: Awaited<ReturnType<typeof packCanvases>>;
    try {
      packed = await packCanvases(
        canvases,
        spacing,
        packerMode,
        fixedSize ? toBaseDimension(atlasWidth, atlasScale) : null,
        fixedSize ? toBaseDimension(atlasHeight, atlasScale) : null,
      );
    } catch (error) {
      console.error(error);
      canvases.forEach((item) => {
        item.canvas.width = 0;
        item.canvas.height = 0;
      });
      alert("The images were loaded, but the atlas could not be created.");
      return;
    }
    if (packed) {
      if (!img && firstFormat) setAtlasImageFormat(firstFormat);
      setOriginalImg(packed.img);
      setOriginalBoxes(packed.boxes);
      await renderScaledAtlas(packed.img, packed.boxes);
      if ((!projectName || projectName === "project") && firstName)
        setProjectName(firstName);
      setBgMode("auto");
      setCustomBoxes(null);
      setSelected([]);
    }
    if (rejected.length) alert(imageLoadErrorsMessage(rejected));
  };

  const handleFiles = async (files?: File[]) => {
    try {
      await importFiles(files);
    } catch (error) {
      console.error(error);
      alert("The selected images could not be added. Please check the files and try again.");
    }
  };

  const handleLoadAtlas = async (fallbackFiles?: File[]) => {
    try {
      let files = fallbackFiles;

      if (!files) {
        const picker = (window as FilePickerWindow).showOpenFilePicker;
        if (!picker) return;
        const handles = await picker.call(window, {
          multiple: true,
          types: [
            {
              description: "Atlas image and JSON",
              accept: {
                "image/png": [".png"],
                "image/webp": [".webp"],
                "image/jpeg": [".jpg", ".jpeg"],
                "image/gif": [".gif"],
                "image/bmp": [".bmp"],
                "image/avif": [".avif"],
                "image/svg+xml": [".svg"],
                "application/json": [".json"],
              },
            },
          ],
        });
        files = await Promise.all(handles.map((handle) => handle.getFile()));
      }

      const imageFiles = (files ?? []).filter(isAtlasImageFile);
      const dataFiles = (files ?? []).filter(isJsonAtlasFile);
      if (imageFiles.length !== 1 || dataFiles.length !== 1 || files?.length !== 2) {
        alert("Choose exactly one atlas image and one JSON atlas file.");
        return;
      }

      const imageFile = imageFiles[0];
      const dataFile = dataFiles[0];
      const [atlas, text] = await Promise.all([
        loadImageFromFile(imageFile),
        dataFile.text(),
      ]);
      const parsed = parseAtlasJson(JSON.parse(text));
      if (!parsed.boxes.length) {
        alert("No sprites found in the selected JSON atlas file.");
        return;
      }
      if (parsed.boxes.some((box) => !isBoxInsideImage(box, atlas))) {
        alert("JSON sprite bounds must stay inside the atlas image.");
        return;
      }

      // Loading is deliberately metadata-only. Keep the source pixels, canvas
      // size, and every imported frame coordinate untouched until an explicit
      // edit or packing action occurs.
      atlasScaleRef.current = 100;
      setAtlasScale(100);
      setAtlasImageFormat(atlasFormatFromFile(imageFile));
      setJsonFormat(parsed.format);
      setOriginalImg(atlas);
      setOriginalBoxes(parsed.boxes);
      setCustomBoxes(parsed.boxes);
      setSelected([]);
      setBgMode("auto");
      await renderScaledAtlas(atlas, parsed.boxes, 100);

      const name = imageFile.name.replace(/\.[^.]+$/, "").trim();
      if (name) setProjectName(name);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(error);
      alert("Failed to load the atlas. Please check the image and JSON files.");
    }
  };

  const applyRepack = async (
    mode = packerMode,
    pad = spacing,
    targetW = originalImg?.width ?? null,
    targetH = originalImg?.height ?? null,
    useFixed = fixedSize,
  ) => {
    if (!originalImg || !originalBoxes.length) return;
    await commitCanonicalAtlas(originalImg, originalBoxes, {
      mode,
      pad,
      fixed: useFixed,
      targetW,
      targetH,
    });
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
        detected = customBoxes;
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

    await commitCanonicalAtlas(sourceImg, detected, {
      mode: nextPackerMode,
      fixed: fixedSize,
      targetW: fixedSize ? sourceImg.width : null,
      targetH: fixedSize ? sourceImg.height : null,
    });
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
          ? parseUnityAtlas(text)
          : parseCustomSprites(JSON.parse(text), jsonFormat);
      if (!next.length) {
        alert("No sprites found in uploaded file.");
        return;
      }
      if (originalImg && next.some((box) => !isBoxInsideImage(box, originalImg))) {
        alert("Custom sprite bounds must stay inside the atlas image.");
        return;
      }
      setOriginalBoxes(next);
      setCustomBoxes(next);
      setSelected([]);
      if (originalImg) {
        // Import is metadata-only: keep the uploaded atlas pixels and canvas
        // dimensions untouched until the user explicitly requests a repack.
        await renderScaledAtlas(originalImg, next);
      } else {
        setBoxes(next);
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
    const filteredBoxes = originalBoxes.filter((_, i) => !toRemove.has(i));
    await applyRepackWithBoxes(filteredBoxes);
  };

  const applyRepackWithBoxes = async (nextBoxes: ComponentBox[]) => {
    if (!originalImg) return;
    await commitCanonicalAtlas(originalImg, nextBoxes, {
      fixed: fixedSize,
      targetW: originalImg.width,
      targetH: originalImg.height,
    });
  };

  const handleCopySelected = async () => {
    if (!originalImg || !selected.length) return;
    clipboardRef.current.forEach(({ canvas }) => {
      canvas.width = 0;
      canvas.height = 0;
    });
    clipboardRef.current = [...selected]
      .sort((a, b) => a - b)
      .flatMap((index) => {
        const box = originalBoxes[index];
        if (!box || !isBoxInsideImage(box, originalImg)) return [];
        const canvas = document.createElement("canvas");
        canvas.width = box.w;
        canvas.height = box.h;
        canvas
          .getContext("2d")
          ?.drawImage(
            originalImg,
            box.x,
            box.y,
            box.w,
            box.h,
            0,
            0,
            box.w,
            box.h,
          );
        return [{ box: cloneBox(box), canvas }];
      });

    if (!clipboardRef.current.length) return;

    const copied = clipboardRef.current;
    const minX = Math.min(...copied.map(({ box }) => box.x));
    const minY = Math.min(...copied.map(({ box }) => box.y));
    const maxRight = Math.max(...copied.map(({ box }) => box.x + box.w));
    const maxBottom = Math.max(...copied.map(({ box }) => box.y + box.h));
    const clipboardCanvas = document.createElement("canvas");
    clipboardCanvas.width = maxRight - minX;
    clipboardCanvas.height = maxBottom - minY;
    const context = clipboardCanvas.getContext("2d");
    if (!context) return;
    copied.forEach(({ box, canvas }) => {
      context.drawImage(canvas, box.x - minX, box.y - minY, box.w, box.h);
    });

    clipboardBlobRef.current = null;
    try {
      const blobPromise = toBlob(clipboardCanvas, "image/png");
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        await blobPromise;
        console.warn("This browser does not support copying images to the system clipboard.");
        return;
      }

      // Passing the pending Blob keeps the clipboard write tied to the keyboard
      // gesture in browsers that require transient user activation (notably Safari).
      const writePromise = navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      const [blob] = await Promise.all([blobPromise, writePromise]);
      clipboardBlobRef.current = blob;
    } catch (error) {
      clipboardBlobRef.current = null;
      console.error("Could not copy the selected sprite to the system clipboard.", error);
    } finally {
      clipboardCanvas.width = 0;
      clipboardCanvas.height = 0;
    }
  };

  const handlePasteSelected = async (files: File[]) => {
    if (!files.length || pasteInProgressRef.current) return;
    pasteInProgressRef.current = true;
    try {
      const isInternalCopy =
        files.length === 1 &&
        clipboardBlobRef.current != null &&
        (await blobsEqual(files[0], clipboardBlobRef.current));

      if (!isInternalCopy) {
        await importFiles(files);
        return;
      }

      if (!originalImg || !clipboardRef.current.length) {
        await importFiles(files);
        return;
      }

      const clipboard = clipboardRef.current;
      const offset = findPasteOffset(
        clipboard.map(({ box }) => box),
        originalBoxes,
      );
      const usedNames = new Set(
        originalBoxes.map((box, index) => spriteNameKey(spriteName(box, index))),
      );
      let nextId = originalBoxes.reduce(
        (max, box) => Math.max(max, typeof box.id === "number" ? box.id : 0),
        0,
      ) + 1;
      const pastedBoxes = clipboard.map(({ box }, index) => {
        const baseName = spriteName(box, index);
        const name = uniqueCopyName(baseName, usedNames);
        usedNames.add(spriteNameKey(name));
        return {
          ...cloneBox(box),
          id: nextId++,
          name,
          x: box.x + offset.x,
          y: box.y + offset.y,
        };
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(
        originalImg.width,
        ...pastedBoxes.map((box) => box.x + box.w),
      );
      canvas.height = Math.max(
        originalImg.height,
        ...pastedBoxes.map((box) => box.y + box.h),
      );
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(originalImg, 0, 0);
      clipboard.forEach((item, index) => {
        const box = pastedBoxes[index];
        context.drawImage(item.canvas, box.x, box.y, box.w, box.h);
      });
      const nextImg = await loadImageFromCanvas(canvas);
      canvas.width = 0;
      canvas.height = 0;
      const firstPastedIndex = originalBoxes.length;
      const nextBoxes = [...originalBoxes, ...pastedBoxes];
      setOriginalImg(nextImg);
      setOriginalBoxes(nextBoxes);
      setCustomBoxes((previous) => (previous ? nextBoxes : previous));
      setSelected(pastedBoxes.map((_, index) => firstPastedIndex + index));
      await renderScaledAtlas(nextImg, nextBoxes);
    } finally {
      pasteInProgressRef.current = false;
    }
  };

  const singleSelected = selected.length === 1 ? selected[0] : null;

  const handleDelete = async () => {
    if (!selected.length || !originalImg) return;
    const selectedSet = new Set(selected);
    const removed = originalBoxes.filter((_, index) => selectedSet.has(index));
    const nextOriginalBoxes = originalBoxes.filter(
      (_, index) => !selectedSet.has(index),
    );
    const clearedOriginalImg = await clearRegions(originalImg, removed);

    setCustomBoxes((previous) =>
      previous
        ? previous.filter((_, index) => !selectedSet.has(index))
        : previous,
    );
    setSelected([]);
    if (!nextOriginalBoxes.length) {
      setOriginalImg(clearedOriginalImg);
      setOriginalBoxes([]);
      setImg(null);
      setBoxes([]);
      setAtlasWidth(null);
      setAtlasHeight(null);
      return;
    }
    await commitCanonicalAtlas(clearedOriginalImg, nextOriginalBoxes, {
      fixed: fixedSize,
      targetW: originalImg.width,
      targetH: originalImg.height,
    });
  };

  const handleReplaceSelected = async (file: File) => {
    if (singleSelected == null || !originalBoxes.length || !originalImg) return;
    let replacement: HTMLImageElement;
    try {
      replacement = await loadImageFromFile(file);
    } catch (error) {
      console.error(error);
      alert(imageLoadErrorMessage(file, error));
      return;
    }

    let spriteCanvases: {
      canvas: HTMLCanvasElement;
      w: number;
      h: number;
      name?: string;
    }[] = [];

    try {
      originalBoxes.forEach((box, index) => {
        const canvas = document.createElement("canvas");
        canvas.width = index === singleSelected ? replacement.width : box.w;
        canvas.height = index === singleSelected ? replacement.height : box.h;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create an image canvas.");
        if (index === singleSelected) {
          context.drawImage(replacement, 0, 0);
        } else {
          context.drawImage(
            originalImg,
            box.x,
            box.y,
            box.w,
            box.h,
            0,
            0,
            box.w,
            box.h,
          );
        }
        spriteCanvases.push({
          canvas,
          w: canvas.width,
          h: canvas.height,
          name: spriteName(box, index),
        });
      });

      const packed = await packCanvases(
        spriteCanvases,
        spacing,
        packerMode,
        fixedSize ? originalImg.width : null,
        fixedSize ? originalImg.height : null,
      );
      if (!packed) {
        alert("The replacement image was loaded, but the atlas could not be updated.");
        return;
      }

      const updatedBoxes = packed.boxes.map((box, index) => {
        const previous = originalBoxes[index];
        if (index !== singleSelected) return { ...previous, ...box };
        return {
          ...previous,
          ...box,
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: box.w, h: box.h },
          sourceSize: { w: box.w, h: box.h },
        };
      });
      setOriginalImg(packed.img);
      setOriginalBoxes(updatedBoxes);
      setCustomBoxes((previous) => (previous ? updatedBoxes : previous));
      await renderScaledAtlas(packed.img, updatedBoxes);
    } catch (error) {
      console.error(error);
      alert("The replacement image was loaded, but the atlas could not be updated.");
    } finally {
      spriteCanvases.forEach(({ canvas }) => {
        canvas.width = 0;
        canvas.height = 0;
      });
    }
  };

  const handleFitSelected = async () => {
    if (singleSelected == null || !originalBoxes.length || !originalImg) return;
    const target = originalBoxes[singleSelected];
    const fitted = detectFittedBoundsForBox(
      originalImg,
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
    if (!isBoxInsideImage(nextBox, originalImg)) {
      alert("Fitted sprite bounds must stay inside the atlas image.");
      return;
    }
    const nextBoxes = originalBoxes.map((b, i) =>
      i === singleSelected ? nextBox : b,
    );
    if (boxesOverlap(nextBoxes)) {
      alert("Fitted sprite bounds overlap another sprite.");
      return;
    }
    setCustomBoxes((prev) =>
      prev ? prev.map((b, i) => (i === singleSelected ? nextBox : b)) : prev,
    );
    await commitCanonicalAtlas(originalImg, nextBoxes, {
      fixed: fixedSize,
      targetW: originalImg.width,
      targetH: originalImg.height,
      clearSelection: false,
    });
  };

  const handleRotateSelected = async (direction: "left" | "right") => {
    if (!selected.length || !originalBoxes.length || !originalImg) return;
    await commitCanonicalAtlas(originalImg, originalBoxes, {
      fixed: fixedSize,
      targetW: originalImg.width,
      targetH: originalImg.height,
      rotate: { indices: selected, direction },
      clearSelection: false,
    });
  };

  const handleClear = () => {
    setBoxes([]);
    setOriginalBoxes([]);
    setImg(null);
    setOriginalImg(null);
    setAtlasWidth(null);
    setAtlasHeight(null);
    setSelected([]);
    setAtlasImageFormat("png");
    setCustomBoxes(null);
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
    tmp.width = 0;
    tmp.height = 0;
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
    tmp.width = 0;
    tmp.height = 0;
  };

  const buildAtlasArtifacts = async () => {
    if (!img || !boxes.length) return null;
    const { mime, extension } = atlasFormatInfo(atlasImageFormat);
    const baseName = safeProjectName(projectName);
    const imageName = `${baseName}.${extension}`;
    const imgCanvas = document.createElement("canvas");
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const ctx = imgCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imageBlob = await toBlob(imgCanvas, mime);
    imgCanvas.width = 0;
    imgCanvas.height = 0;
    if (imageBlob.type !== mime) {
      throw new Error(`This browser cannot export ${extension.toUpperCase()} images.`);
    }
    const ordered = orderBoxes(boxes);
    const frames = ordered.map((b, i) => ({
      filename: (b.name && b.name.trim()) || `sprite-${i + 1}`,
      frame: { x: b.x, y: b.y, w: b.w, h: b.h },
      rotated: b.rotated ?? false,
      trimmed: b.trimmed ?? false,
      spriteSourceSize: b.spriteSourceSize ?? {
        x: 0,
        y: 0,
        w: b.w,
        h: b.h,
      },
      sourceSize: b.sourceSize ?? { w: b.w, h: b.h },
    }));
    const meta = {
      app: "{http://spritepacker.app/}",
      version: "SpritePacker v.1.0.0",
      image: imageName,
      size: { w: img.width, h: img.height },
      scale: atlasScale / 100,
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
    if (originalImg && originalBoxes.length) {
      await applyRepack(
        mode,
        pad,
        originalImg.width,
        originalImg.height,
        fixedSize,
      );
      return;
    }
    await detectAndRepackForMode(mode);
  };

  const onAtlasWidthChange = async (v: number | null) => {
    if (!fixedSize) return;
    if (v == null || !originalImg) {
      setAtlasWidth(v);
      return;
    }
    await applyRepack(
      packerMode,
      spacing,
      toBaseDimension(v, atlasScale),
      originalImg.height,
      true,
    );
  };
  const onAtlasHeightChange = async (v: number | null) => {
    if (!fixedSize) return;
    if (v == null || !originalImg) {
      setAtlasHeight(v);
      return;
    }
    await applyRepack(
      packerMode,
      spacing,
      originalImg.width,
      toBaseDimension(v, atlasScale),
      true,
    );
  };
  const onFixedSizeChange = async (v: boolean) => {
    if (!v) return;
    setFixedSize(true);
    if (!originalImg) {
      setAtlasWidth((current) => current ?? 2048);
      setAtlasHeight((current) => current ?? 2048);
      return;
    }
    await applyRepack(
      packerMode,
      spacing,
      originalImg?.width ?? null,
      originalImg?.height ?? null,
      true,
    );
  };
  const onAutoSizeChange = async (v: boolean) => {
    if (!v) return;
    setFixedSize(false);
    if (!originalImg) {
      setAtlasWidth(null);
      setAtlasHeight(null);
      return;
    }
    await applyRepack(packerMode, spacing, null, null, false);
  };
  const onAtlasScaleChange = async (v: number) => {
    const next = clampAtlasScale(v);
    atlasScaleRef.current = next;
    setAtlasScale(next);
    if (originalImg && originalBoxes.length) {
      await renderScaledAtlas(originalImg, originalBoxes, next);
    }
  };

  const selectedBox = singleSelected != null ? boxes[singleSelected] : null;

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
    autoSize: !fixedSize,
    atlasScale,
    downloadMode,
    atlasImageFormat,
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
    onLoadAtlas: handleLoadAtlas,
    onDetect: handleDetect,
    onCustomJson: handleCustomJson,
    onSelect,
    onSelectMany,
    onMoveBox,
    onCopySelected: handleCopySelected,
    onPasteSelected: handlePasteSelected,
    onDeleteSelected: handleDelete,
    onClearAll: handleClear,
    onUpdateSelected: async (next, applyToImage = false) => {
      if (singleSelected == null || !selectedBox) return;
      const nextDisplayBox: ComponentBox = {
        ...selectedBox,
        ...next,
        name: next.name?.trim(),
      };
      const duplicateIndex = nextDisplayBox.name
        ? boxes.findIndex(
            (box, index) =>
              index !== singleSelected &&
              spriteNameKey(spriteName(box, index)) ===
                spriteNameKey(nextDisplayBox.name || ""),
          )
        : -1;
      if (
        duplicateIndex >= 0 &&
        !confirm(
          `A sprite named "${nextDisplayBox.name}" already exists. Replace it?`,
        )
      ) {
        return;
      }
      const overlapCandidates = boxes
        .map((box, index) => (index === singleSelected ? nextDisplayBox : box))
        .filter((_, index) => index !== duplicateIndex);
      if (boxesOverlap(overlapCandidates)) {
        alert("Updated sprite bounds overlap another sprite.");
        return;
      }

      const originalSelected = originalBoxes[singleSelected];
      if (!originalSelected || !originalImg) return;
      const displayGeometryChanged =
        selectedBox.x !== nextDisplayBox.x ||
        selectedBox.y !== nextDisplayBox.y ||
        selectedBox.w !== nextDisplayBox.w ||
        selectedBox.h !== nextDisplayBox.h;
      const nextBox = displayGeometryChanged
        ? unscaleBox(nextDisplayBox, atlasScale / 100)
        : { ...originalSelected, name: nextDisplayBox.name };
      const geometryChanged =
        originalSelected.x !== nextBox.x ||
        originalSelected.y !== nextBox.y ||
        originalSelected.w !== nextBox.w ||
        originalSelected.h !== nextBox.h;

      if (!isBoxInsideImage(nextBox, originalImg)) {
        alert("Updated sprite bounds must stay inside the atlas image.");
        return;
      }

      let nextOriginal: HTMLImageElement | null = originalImg;
      if (applyToImage && geometryChanged) {
        nextOriginal = await transformImageRegion(
          originalImg,
          originalSelected,
          nextBox,
        );
        if (!nextOriginal) {
          alert("Could not apply sprite changes to source image.");
          return;
        }
      }

      if (duplicateIndex >= 0) {
        const duplicateOriginalBox = originalBoxes[duplicateIndex];
        if (nextOriginal && duplicateOriginalBox) {
          nextOriginal = await clearRegionPreservingBox(
            nextOriginal,
            duplicateOriginalBox,
            nextBox,
          );
        }
      }
      if (!nextOriginal) return;
      const nextOriginalBoxes = originalBoxes
        .map((box, index) => (index === singleSelected ? nextBox : box))
        .filter((_, index) => index !== duplicateIndex);
      setCustomBoxes((prev) =>
        prev
          ? prev
              .map((box, index) => (index === singleSelected ? nextBox : box))
              .filter((_, index) => index !== duplicateIndex)
          : prev,
      );
      await commitCanonicalAtlas(nextOriginal, nextOriginalBoxes, {
        fixed: fixedSize,
        targetW: originalImg.width,
        targetH: originalImg.height,
        clearSelection: false,
      });
      if (duplicateIndex >= 0 && duplicateIndex < singleSelected) {
        setSelected([singleSelected - 1]);
      }
    },
    onReplaceSelected: handleReplaceSelected,
    onFitSelected: handleFitSelected,
    onRotateSelected: handleRotateSelected,
    onPackerChange: handlePackerChange,
    onAtlasWidth: onAtlasWidthChange,
    onAtlasHeight: onAtlasHeightChange,
    onFixedSize: onFixedSizeChange,
    onAutoSize: onAutoSizeChange,
    onAtlasScale: onAtlasScaleChange,
    onJsonFormat: setJsonFormat,
    onSpacing: async (v: number) => {
      const next = Number.isNaN(v) ? 5 : Math.max(5, v);
      setSpacing(next);
      await applyRepack(
        packerMode,
        next,
        originalImg?.width ?? null,
        originalImg?.height ?? null,
        fixedSize,
      );
    },
    onDetectDuplicates: detectDuplicates,
    onDeleteDuplicates: deleteDuplicates,
    onDownload: async () => {
      if (!img || !boxes.length) return;
      if (
        downloadMode === "sprites" &&
        !archive &&
        boxes.length >= 10 &&
        !confirm(
          `Export ${boxes.length} sprites as individual files? Your browser may ask you to confirm, save, or cancel many separate downloads.`,
        )
      ) return;
      try {
        if (downloadMode === "sprites") {
          if (archive) await downloadSpritesZip();
          else await downloadSpritesFiles();
        } else if (archive) {
          await downloadAtlasZip();
        } else {
          await downloadAtlasFiles();
        }
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : "Download failed.");
      }
    },
    onDownloadMode: setDownloadMode,
    onAtlasImageFormat: setAtlasImageFormat,
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

function clampAtlasScale(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(800, Math.max(10, Math.round(value)));
}

function scaleBox(box: ComponentBox, scale: number): ComponentBox {
  const x = Math.round(box.x * scale);
  const y = Math.round(box.y * scale);
  const right = Math.round((box.x + box.w) * scale);
  const bottom = Math.round((box.y + box.h) * scale);
  return {
    ...box,
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
    spriteSourceSize: box.spriteSourceSize
      ? scaleRect(box.spriteSourceSize, scale)
      : undefined,
    sourceSize: box.sourceSize
      ? {
          w: Math.max(1, Math.round(box.sourceSize.w * scale)),
          h: Math.max(1, Math.round(box.sourceSize.h * scale)),
        }
      : undefined,
  };
}

function unscaleBox(box: ComponentBox, scale: number): ComponentBox {
  const safeScale = scale > 0 ? scale : 1;
  const x = Math.round(box.x / safeScale);
  const y = Math.round(box.y / safeScale);
  const right = Math.round((box.x + box.w) / safeScale);
  const bottom = Math.round((box.y + box.h) / safeScale);
  return {
    ...box,
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
    spriteSourceSize: box.spriteSourceSize
      ? scaleRect(box.spriteSourceSize, 1 / safeScale)
      : undefined,
    sourceSize: box.sourceSize
      ? {
          w: Math.max(1, Math.round(box.sourceSize.w / safeScale)),
          h: Math.max(1, Math.round(box.sourceSize.h / safeScale)),
        }
      : undefined,
  };
}

function scaleRect(
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
) {
  const x = Math.round(rect.x * scale);
  const y = Math.round(rect.y * scale);
  const right = Math.round((rect.x + rect.w) * scale);
  const bottom = Math.round((rect.y + rect.h) * scale);
  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
  };
}

function fitBoxInsideImage(
  box: ComponentBox,
  image: HTMLImageElement,
): ComponentBox {
  const x = Math.max(0, Math.min(image.width - 1, box.x));
  const y = Math.max(0, Math.min(image.height - 1, box.y));
  return {
    ...box,
    x,
    y,
    w: Math.max(1, Math.min(box.w, image.width - x)),
    h: Math.max(1, Math.min(box.h, image.height - y)),
  };
}

function toBaseDimension(value: number | null, scalePercent: number): number | null {
  if (value == null) return null;
  return Math.max(1, Math.round(value / (clampAtlasScale(scalePercent) / 100)));
}

function boxesOverlap(boxes: ComponentBox[]): boolean {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) return true;
    }
  }
  return false;
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
  let current: ComponentBox | null = null;

  const flush = () => {
    if (current && current.w > 0 && current.h > 0) {
      boxes.push({
        ...current,
        id: boxes.length + 1,
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
      current = { name: line, x: 0, y: 0, w: 0, h: 0, rotated: false };
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
    } else if (key === "rotate") {
      current.rotated = parseRotation(value);
    } else if (key === "orig") {
      const [w, h] = value.split(",").map((n) => parseInt(n.trim(), 10) || 0);
      if (w > 0 && h > 0) current.sourceSize = { w, h };
    } else if (key === "offset") {
      const [x, y] = value.split(",").map((n) => parseInt(n.trim(), 10) || 0);
      current.spriteSourceSize = { x, y, w: current.w, h: current.h };
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
        ...parseImportedFrameMetadata(e),
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
          ...parseImportedFrameMetadata(e),
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
        ...parseImportedFrameMetadata(e),
      }))
      .filter((b) => b.w > 0 && b.h > 0);
  }
  return [];
}

function parseAtlasJson(data: any): {
  boxes: ComponentBox[];
  format: JsonFormat;
} {
  if (!data || typeof data !== "object") {
    return { boxes: [], format: "json-array" };
  }

  if (Array.isArray(data) || Array.isArray(data.frames)) {
    return {
      boxes: parseCustomSprites(data, "json-array"),
      format: "json-array",
    };
  }

  const frameCollection = data.frames ?? data;
  if (
    frameCollection &&
    typeof frameCollection === "object" &&
    !Array.isArray(frameCollection)
  ) {
    return {
      boxes: parseCustomSprites(data, "json-hash"),
      format: "json-hash",
    };
  }

  return { boxes: [], format: "json-array" };
}

function isAtlasImageFile(file: File): boolean {
  return (
    file.type.toLowerCase().startsWith("image/") ||
    /\.(png|apng|webp|jpe?g|jfif|gif|bmp|dib|avif|svg|ico|tiff?|heic|heif)$/i.test(file.name)
  );
}

function isJsonAtlasFile(file: File): boolean {
  return (
    file.type.toLowerCase() === "application/json" ||
    /\.json$/i.test(file.name)
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function imageLoadErrorMessage(file: File, error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Could not read")) {
    return error.message;
  }
  return `Could not read "${file.name}". The file may be invalid or use an image format this browser does not support.`;
}

function imageLoadErrorsMessage(
  failures: { file: File; error: unknown }[],
): string {
  if (failures.length === 1) {
    return imageLoadErrorMessage(failures[0].file, failures[0].error);
  }
  const visibleNames = failures
    .slice(0, 5)
    .map(({ file }) => `“${file.name}”`)
    .join(", ");
  const remainder = failures.length > 5 ? ` and ${failures.length - 5} more` : "";
  return `${failures.length} images could not be read: ${visibleNames}${remainder}. They may be invalid or use formats this browser does not support.`;
}

function parseImportedFrameMetadata(entry: any): Pick<
  ComponentBox,
  "rotated" | "trimmed" | "spriteSourceSize" | "sourceSize"
> {
  return {
    rotated: parseRotation(entry?.rotated ?? entry?.rotate),
    trimmed: Boolean(entry?.trimmed),
    spriteSourceSize: parseRect(entry?.spriteSourceSize),
    sourceSize: parseSize(entry?.sourceSize),
  };
}

function parseRotation(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !["", "0", "false", "none", "no"].includes(normalized);
  }
  return Boolean(value);
}

function parseRect(value: any) {
  if (!value || typeof value !== "object") return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  const w = Number(value.w);
  const h = Number(value.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    return undefined;
  }
  return { x, y, w, h };
}

function parseSize(value: any) {
  if (!value || typeof value !== "object") return undefined;
  const w = Number(value.w);
  const h = Number(value.h);
  if (![w, h].every(Number.isFinite) || w <= 0 || h <= 0) return undefined;
  return { w, h };
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

async function clearRegions(
  img: HTMLImageElement,
  boxes: ComponentBox[],
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  boxes.forEach((box) => ctx.clearRect(box.x, box.y, box.w, box.h));
  return loadImageFromCanvas(canvas);
}

async function clearRegionPreservingBox(
  img: HTMLImageElement,
  removed: ComponentBox,
  kept: ComponentBox,
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  if (overlaps(removed, kept)) {
    const crop = document.createElement("canvas");
    crop.width = kept.w;
    crop.height = kept.h;
    crop.getContext("2d")?.drawImage(img, kept.x, kept.y, kept.w, kept.h, 0, 0, kept.w, kept.h);
    ctx.clearRect(removed.x, removed.y, removed.w, removed.h);
    ctx.drawImage(crop, kept.x, kept.y);
    crop.width = 0;
    crop.height = 0;
  } else {
    ctx.clearRect(removed.x, removed.y, removed.w, removed.h);
  }
  return loadImageFromCanvas(canvas);
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
  return loadImageFromCanvas(canvas);
}

async function packCanvases(
  items: { canvas: HTMLCanvasElement; w: number; h: number; name?: string }[],
  spacing: number,
  mode: "default" | "optimal" | "maxrect",
  targetW?: number | null,
  targetH?: number | null,
): Promise<{ img: HTMLImageElement; boxes: ComponentBox[] } | null> {
  if (!items.length) return null;
  const pad = Math.max(5, spacing);
  if (mode === "optimal") {
    const packed = findOptimalShelfPacking(items, pad, targetW);
    if (!packed) return null;
    const atlasW = targetW && targetW > 0
      ? Math.max(packed.w, targetW)
      : packed.w;
    const atlasH = targetH && targetH > 0
      ? Math.max(packed.h, targetH)
      : packed.h;
    const canvas = document.createElement("canvas");
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    packed.placements.forEach(({ item, x, y }) => {
      ctx.drawImage(item.canvas, x, y, item.w, item.h);
    });
    const outImg = await loadImageFromCanvas(canvas);
    const outBoxes = [...packed.placements]
      .sort((a, b) => a.index - b.index)
      .map(({ item, x, y }, index) => ({
        id: index + 1,
        name: item.name || `sprite-${index + 1}`,
        x,
        y,
        w: item.w,
        h: item.h,
      }));
    items.forEach((item) => {
      item.canvas.width = 0;
      item.canvas.height = 0;
    });
    return { img: outImg, boxes: outBoxes };
  }

  const totalArea = items.reduce((s, b) => s + b.w * b.h, 0);
  const minWidth = Math.max(...items.map((b) => b.w));
  const sqrtW = Math.floor(Math.sqrt(totalArea));
  const candidates = new Set<number>([
    minWidth,
    Math.max(minWidth, sqrtW),
    Math.max(minWidth, sqrtW + pad),
    Math.max(minWidth, sqrtW - pad),
  ]);
  let cumulativeWidth = 0;
  for (const item of items) {
    cumulativeWidth += (cumulativeWidth > 0 ? pad : 0) + item.w;
    candidates.add(Math.max(minWidth, cumulativeWidth));
  }
  if (targetW && targetW > 0) candidates.add(Math.max(minWidth, targetW));
  let best: {
    placements: {
      idx: number;
      name?: string;
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
      idx: number;
      name?: string;
      x: number;
      y: number;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    }[] = [];
    const ordered = items
      .map((item, idx) => ({ ...item, idx }))
      .sort((a, b) => {
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
      w * h < best.w * best.h ||
      (w * h === best.w * best.h && Math.abs(w - h) < Math.abs(best.w - best.h))
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
  const outImg = await loadImageFromCanvas(canvas);
  const outBoxes = [...best.placements]
    .sort((a, b) => a.idx - b.idx)
    .map((p, i) => ({
      id: i + 1,
      name: p.name || `sprite-${i + 1}`,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
    }));
  items.forEach((item) => {
    item.canvas.width = 0;
    item.canvas.height = 0;
  });
  return { img: outImg, boxes: outBoxes };
}

function spriteName(box: ComponentBox, index: number): string {
  return box.name?.trim() || `sprite-${index + 1}`;
}

function cloneBox(box: ComponentBox): ComponentBox {
  return {
    ...box,
    spriteSourceSize: box.spriteSourceSize
      ? { ...box.spriteSourceSize }
      : undefined,
    sourceSize: box.sourceSize ? { ...box.sourceSize } : undefined,
  };
}

function findPasteOffset(
  copied: ComponentBox[],
  existing: ComponentBox[],
): { x: number; y: number } {
  const step = 10;
  for (let attempt = 1; attempt <= 10_000; attempt++) {
    const offset = { x: step * attempt, y: step * attempt };
    const candidates = copied.map((box) => ({
      ...box,
      x: box.x + offset.x,
      y: box.y + offset.y,
    }));
    if (!candidates.some((box) => existing.some((item) => overlaps(box, item)))) {
      return offset;
    }
  }

  const minCopiedX = Math.min(...copied.map((box) => box.x));
  const maxExistingRight = Math.max(0, ...existing.map((box) => box.x + box.w));
  return { x: maxExistingRight - minCopiedX + step, y: step };
}

function uniqueCopyName(baseName: string, usedNames: Set<string>): string {
  let candidate = `${baseName} copy`;
  let number = 2;
  while (usedNames.has(spriteNameKey(candidate))) {
    candidate = `${baseName} copy ${number++}`;
  }
  return candidate;
}

function spriteNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

async function blobsEqual(left: Blob, right: Blob): Promise<boolean> {
  if (left.size !== right.size || left.type !== right.type) return false;
  const [leftBytes, rightBytes] = await Promise.all([
    left.arrayBuffer(),
    right.arrayBuffer(),
  ]);
  const a = new Uint8Array(leftBytes);
  const b = new Uint8Array(rightBytes);
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return false;
  }
  return true;
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
    lines.push(`  rotate: ${f.rotated ? "true" : "false"}`);
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
