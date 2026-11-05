// Light/dark theme. The design is dark, so that's the default; a choice made
// with the toggle is stored per browser. The `.dark` class on <html> drives
// both the CSS tokens in styles.css and Tailwind's `dark:` variant.

export const THEME_STORAGE_KEY = 'settlr:theme'

export type Theme = 'light' | 'dark'

// Inlined into <head> by src/app/layout.tsx so the class is set before first
// paint. SSR can't know the viewer's choice, so without this the page would
// flash.
export const themeInitScript = `(function () {
  var dark = true;
  try {
    dark = localStorage.getItem('${THEME_STORAGE_KEY}') !== 'light';
  } catch (e) {}
  document.documentElement.classList.toggle('dark', dark);
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
