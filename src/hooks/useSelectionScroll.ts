import { useEffect } from "react";

export function useSelectionScroll<T extends HTMLElement>(
  selected: number | null,
  refs: React.MutableRefObject<Record<number, T | null>>,
) {
  useEffect(() => {
    if (selected == null) return;
    const el = refs.current[selected];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, refs]);
}
