// Appearance: light/dark theme, accent colour, frame and motion, all stored
// per browser. Until the viewer picks a theme it follows the system setting,
// live. The `.dark` class on <html> drives both the CSS tokens in styles.css
// and Tailwind's `dark:` variant; `data-accent` swaps the accent (Gr8r
// Studio's choices), `data-frame="plain"` makes the app frame match the page
// instead of taking the accent, and `data-motion="reduce"` turns animations
// off.

export const THEME_STORAGE_KEY = 'settlr:theme'
export const ACCENT_STORAGE_KEY = 'settlr:accent'
export const MOTION_STORAGE_KEY = 'settlr:motion'
export const FRAME_STORAGE_KEY = 'settlr:frame'

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
/** The app frame (sidebar, top bar and rim): the accent tint, or the page's colour. */
export type Frame = 'tint' | 'plain'

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
  if (read('${FRAME_STORAGE_KEY}') === 'plain') root.setAttribute('data-frame', 'plain');
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

/** Where a theme switch starts from, in viewport pixels. */
export type RevealOrigin = { x: number; y: number }

/**
 * The centre of the control an event came from (a button, menu item or
 * tab), for `applyTheme`'s wipe. Undefined when there's no element.
 */
export function originOf(event: Event | { target: EventTarget | null } | undefined) {
  const target = event?.target
  if (!(target instanceof Element)) return undefined
  const control = target.closest('button, [role="menuitem"], [role="tab"]') ?? target
  const box = control.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Switches light/dark. From `origin` (the control pressed), the new theme
 * pours out of it in a growing circle, over the old one (Lucid Dungeon's
 * wipe); without one it cross-fades like the other appearance changes.
 */
export function applyTheme(choice: ThemeChoice, origin?: RevealOrigin) {
  const dark =
    choice === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : choice === 'dark'
  write(THEME_STORAGE_KEY, choice === 'system' ? null : choice)
  if (dark === (currentTheme() === 'dark')) return
  const change = () => document.documentElement.classList.toggle('dark', dark)
  if (origin) circleReveal(origin, change)
  else withViewTransition(change)
}

const REVEAL_TIMING: KeyframeAnimationOptions = {
  duration: 480,
  // Brisk start, gentle landing: one gesture rather than something drawn.
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  pseudoElement: '::view-transition-new(root)',
}

/**
 * Applies `change` in a view transition whose new snapshot is clipped by a
 * circle growing from `origin` until it covers the furthest corner. Every
 * frame shows one finished theme or the other, never a blend of the two.
 * `data-reveal` on <html> switches the default cross-fade off for it
 * (styles.css). Unsupported browsers and reduced motion just switch.
 */
function circleReveal({ x, y }: RevealOrigin, change: () => void) {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    change()
    return
  }
  const root = document.documentElement
  root.dataset.reveal = ''
  const transition = document.startViewTransition(change)
  transition.ready
    .then(() => {
      const width = window.innerWidth
      const height = window.innerHeight
      const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
      // In percentages of the snapshot rather than pixels: mobile browsers
      // can size the snapshot differently from the viewport (a collapsible
      // address bar), and percentages still land on the button. A circle's
      // percentage radius is of the box's diagonal over √2.
      const at = `${(x / width) * 100}% ${(y / height) * 100}%`
      const reach = (radius / (Math.hypot(width, height) / Math.SQRT2)) * 100
      root.animate(
        { clipPath: [`circle(0% at ${at})`, `circle(${reach}% at ${at})`] },
        REVEAL_TIMING,
      )
    })
    .catch(() => {})
  transition.finished.finally(() => delete root.dataset.reveal)
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

export function readFrame(): Frame {
  return read(FRAME_STORAGE_KEY) === 'plain' ? 'plain' : 'tint'
}

export function applyFrame(frame: Frame) {
  write(FRAME_STORAGE_KEY, frame === 'plain' ? 'plain' : null)
  withViewTransition(() => {
    if (frame === 'plain') document.documentElement.dataset.frame = 'plain'
    else delete document.documentElement.dataset.frame
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
