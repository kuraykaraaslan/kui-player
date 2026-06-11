import { useCallback, useEffect, useState } from "react";

/**
 * Demo theme manager — mirrors the KUIviewer demo contract:
 *   - localStorage["theme"] holds "light" | "dark" | "system"
 *   - "system" (or missing) follows prefers-color-scheme
 *   - resolved theme toggles the `.dark` class on <html> (Tailwind dark
 *     tokens in globals.css re-cascade) AND sets data-theme + colorScheme
 *     so browser chrome flips along with the app.
 * The synchronous bootstrap in index.html applies the class before paint so
 * there's no flash of the wrong theme; this hook just keeps React in sync.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function applyTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.setAttribute("data-theme", resolved);
  el.style.colorScheme = resolved;
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(resolveTheme(preference));
  }, [preference]);

  // Re-resolve when the OS preference changes — but only while in "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPreference() === "system") applyTheme(resolveTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    setPreference(pref);
  }, []);

  return { preference, resolved: resolveTheme(preference), setTheme };
}
