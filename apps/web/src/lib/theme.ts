// Appearance: light/dark theme, accent colour and motion, all stored per
// browser. Until the viewer picks a theme it follows the system setting,
// live. The `.dark` class on <html> drives both the CSS tokens in styles.css
// and Tailwind's `dark:` variant; `data-accent` swaps the accent (Gr8r
// Studio's choices) and `data-motion="reduce"` turns animations off.

export const THEME_STORAGE_KEY = 'settlr:theme'
export const ACCENT_STORAGE_KEY = 'settlr:accent'
export const MOTION_STORAGE_KEY = 'settlr:motion'

export type Theme = 'light' | 'dark'
export type ThemeChoice = Theme | 'system'

/**
 * Gr8r's accents, with their light and dark values for the swatches (the
 * same values as `--acc-l`/`--acc-d` in styles.css). Indigo is the default.
 */
export const ACCENTS = [
  { value: 'indigo', label: 'Indigo', light: '#4b5bd6', dark: '#8e9af3' },
  { value: 'blue', label: 'Blue', light: '#2f6cd4', dark: '#74a7f0' },
  { value: 'violet', label: 'Violet', light: '#7348cc', dark: '#ae93f0' },
  { value: 'teal', label: 'Teal', light: '#1a7f7a', dark: '#5cc4ba' },
  { value: 'rose', label: 'Rose', light: '#b93d68', dark: '#ec8dae' },
  { value: 'graphite', label: 'Graphite', light: '#34332f', dark: '#d9d6cf' },
] as const

export type Accent = (typeof ACCENTS)[number]['value']
export type Motion = 'system' | 'reduce'

const DEFAULT_ACCENT: Accent = 'indigo'

// Inlined into <head> by src/app/layout.tsx so the class and attributes are
// set before first paint. SSR can't know the viewer's choices, so without
// this the page would flash.
export const themeInitScript = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function apply() {
    var choice = read('${THEME_STORAGE_KEY}');
    root.classList.toggle('dark', choice ? choice === 'dark' : media.matches);
  }
  apply();
  if (media.addEventListener) media.addEventListener('change', apply);
  var accent = read('${ACCENT_STORAGE_KEY}');
  if (accent && accent !== '${DEFAULT_ACCENT}') root.setAttribute('data-accent', accent);
  if (read('${MOTION_STORAGE_KEY}') === 'reduce') root.setAttribute('data-motion', 'reduce');
})();`

function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // choice then lasts until the next reload.
  }
}

/** Whether animations should run: the system setting or the viewer's choice. */
export function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Runs a change to the page's colours inside a view transition, so the old
 * look cross-fades into the new one (styles.css sets its timing). Browsers
 * without view transitions, and reduced motion, just switch.
 */
function withViewTransition(change: () => void) {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    change()
    return
  }
  document.startViewTransition(change)
}

/** The theme on screen now. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** What the viewer picked: light, dark, or follow the system. */
export function readThemeChoice(): ThemeChoice {
  const stored = read(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : choice === 'dark'
  write(THEME_STORAGE_KEY, choice === 'system' ? null : choice)
  if (dark === (currentTheme() === 'dark')) return
  withViewTransition(() => document.documentElement.classList.toggle('dark', dark))
}

export function readAccent(): Accent {
  const stored = read(ACCENT_STORAGE_KEY)
  return ACCENTS.some((accent) => accent.value === stored) ? (stored as Accent) : DEFAULT_ACCENT
}

export function applyAccent(accent: Accent) {
  write(ACCENT_STORAGE_KEY, accent === DEFAULT_ACCENT ? null : accent)
  withViewTransition(() => {
    if (accent === DEFAULT_ACCENT) delete document.documentElement.dataset.accent
    else document.documentElement.dataset.accent = accent
  })
}

export function readMotion(): Motion {
  return read(MOTION_STORAGE_KEY) === 'reduce' ? 'reduce' : 'system'
}

export function applyMotion(motion: Motion) {
  write(MOTION_STORAGE_KEY, motion === 'reduce' ? 'reduce' : null)
  if (motion === 'reduce') document.documentElement.dataset.motion = 'reduce'
  else delete document.documentElement.dataset.motion
}
