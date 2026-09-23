import { useEffect } from "react";

export function useSelectionScroll<T extends HTMLElement>(
  selected: number[],
  refs: React.MutableRefObject<Record<number, T | null>>,
) {
  useEffect(() => {
    const lastSelected = selected[selected.length - 1];
    if (lastSelected == null) return;
    const el = refs.current[lastSelected];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, refs]);
}
