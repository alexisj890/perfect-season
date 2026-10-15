// Applies saved settings that change how the page looks (Larger text) before
// the first paint, so there's no flash of the wrong size. Runs in <head> (see
// app/layout.tsx), like the theme script. Kept apart from useSettings.ts so the
// server layout can import it.

export const SETTINGS_STORAGE_KEY = "perfect-season:settings";

export const SETTINGS_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${SETTINGS_STORAGE_KEY}")||"{}");if(s&&s.largeText===true)document.documentElement.setAttribute("data-text-size","large")}catch(e){}})()`;
