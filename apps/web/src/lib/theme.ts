// Light/dark theme. Until the viewer picks one with the toggle (stored per
// browser), it follows the system setting, live. The `.dark` class on <html> drives
// both the CSS tokens in styles.css and Tailwind's `dark:` variant.

export const THEME_STORAGE_KEY = 'settlr:theme'

export type Theme = 'light' | 'dark'

// Inlined into <head> by src/app/layout.tsx so the class is set before first
// paint. SSR can't know the viewer's choice, so without this the page would
// flash.
export const themeInitScript = `(function () {
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var choice = null;
    try {
      choice = localStorage.getItem('${THEME_STORAGE_KEY}');
    } catch (e) {}
    var dark = choice ? choice === 'dark' : media.matches;
    document.documentElement.classList.toggle('dark', dark);
  }
  apply();
  if (media.addEventListener) media.addEventListener('change', apply);
})();`

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // choice then lasts until the next reload.
  }
}
