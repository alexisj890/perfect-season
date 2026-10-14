"use client";

// Day / night switch. The current theme lives on <html data-theme="..."> and in
// localStorage; CSS decides which icon shows, so this component needs no React
// state and renders the same on the server and in the browser.

export const THEME_STORAGE_KEY = "perfect-season:theme";

// Runs in <head> before the page paints (see app/layout.tsx).
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="day"||t==="night")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "day" ? "night" : "day";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the theme still changes for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between day and night theme"
      className="flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted hover:text-foreground"
    >
      <span className="dark:hidden">☀️ Day</span>
      <span className="hidden dark:inline">🌙 Night</span>
    </button>
  );
}
