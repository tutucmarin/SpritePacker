import { useEffect, useState } from "react";

export type BackgroundMode = "transparent" | "clear" | "white" | "pink" | "black";

export function useThemePrefs(defaultBg: BackgroundMode = "transparent") {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [background, setBackground] = useState<BackgroundMode>(defaultBg);

  // restore saved prefs
  useEffect(() => {
    const savedTheme =
      typeof window !== "undefined"
        ? (localStorage.getItem("sf_theme") as "light" | "dark" | null)
        : null;
    const savedBg =
      typeof window !== "undefined"
        ? (localStorage.getItem("sf_background") as BackgroundMode | null)
        : null;
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    if (savedBg) setBackground(savedBg);
  }, []);

  // apply and persist theme/background
  useEffect(() => {
    document.body.dataset.theme = theme;
    if (typeof window !== "undefined") {
      localStorage.setItem("sf_theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sf_background", background);
    }
  }, [background]);

  return { theme, setTheme, background, setBackground };
}
