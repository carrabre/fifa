import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>("dark");

  // Initialise theme from localStorage or system preference
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      applyThemeClass(storedTheme);
    } else {
      // Fallback to system preference
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const initialTheme: Theme = prefersLight ? "light" : "dark";
      setTheme(initialTheme);
      applyThemeClass(initialTheme);
    }
  }, []);

  const applyThemeClass = useCallback((t: Theme) => {
    if (typeof document === "undefined") return;

    // Remove both theme classes first
    document.documentElement.classList.remove("light-mode", "dark-mode");
    if (t === "light") {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.add("dark-mode");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyThemeClass(next);
      return next;
    });
  }, [applyThemeClass]);

  return { theme, toggleTheme };
} 