import { useEffect } from "react";

// Prevent browser-level zoom so canvas-local zoom controls stay predictable.
export function useDisablePageZoom() {
  useEffect(() => {
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const preventGesture = (e: Event) => e.preventDefault();
    const preventKeyZoom = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const key = e.key;
        if (key === "+" || key === "=" || key === "-" || key === "_" || key === "0") {
          e.preventDefault();
        }
      }
    };
    window.addEventListener("wheel", preventWheelZoom, { passive: false, capture: true });
    window.addEventListener("gesturestart", preventGesture, { passive: false, capture: true } as any);
    window.addEventListener("gesturechange", preventGesture, { passive: false, capture: true } as any);
    window.addEventListener("keydown", preventKeyZoom, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", preventWheelZoom, { capture: true } as any);
      window.removeEventListener("gesturestart", preventGesture, { capture: true } as any);
      window.removeEventListener("gesturechange", preventGesture, { capture: true } as any);
      window.removeEventListener("keydown", preventKeyZoom, { capture: true } as any);
    };
  }, []);
}
