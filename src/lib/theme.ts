// Light/dark theme. The choice is stored per browser; with no stored choice
// the OS setting wins. The `.dark` class on <html> drives both the CSS tokens
// in styles.css and Tailwind's `dark:` variant.

export const THEME_STORAGE_KEY = 'settlr:theme'

export type Theme = 'light' | 'dark'

// Inlined into <head> by __root.tsx so the class is set before first paint.
// SSR can't know the viewer's theme, so without this the page would flash.
export const themeInitScript = `(function () {
  var dark;
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') dark = stored === 'dark';
  } catch (e) {}
  if (dark === undefined) dark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
})();`

export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function applyTheme(theme: Theme, { persist }: { persist: boolean }) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  if (!persist) return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // choice then lasts until the next reload.
  }
}
