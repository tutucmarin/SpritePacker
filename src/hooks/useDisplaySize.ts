import { useEffect, useState } from "react";

export function useDisplaySize(
  img: HTMLImageElement | null,
  stageRef: React.RefObject<HTMLDivElement>,
) {
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    function computeSize() {
      if (!stageRef.current || !img) return;
      const box = stageRef.current.getBoundingClientRect();
      const scale = Math.min(box.width / img.width, box.height / img.height, 1);
      const w = Math.max(1, Math.floor(img.width * scale));
      const h = Math.max(1, Math.floor(img.height * scale));
      setDisplaySize({ w, h });
    }
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => window.removeEventListener("resize", computeSize);
  }, [img, stageRef]);

  return displaySize;
}
