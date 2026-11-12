// Design tokens from design/DESIGN.md and design/screens/android/*.html.
// Dark is the reference theme; light matches home-light.html and the web
// app's light tokens (apps/web/src/styles.css). Use these, not hex values,
// except for the fixed group, category and avatar fills.

export type Colors = {
  bg: string
  bgSidebar: string
  surface: string
  surface2: string
  field: string
  border: string
  borderStrong: string
  divider: string
  text: string
  text2: string
  muted: string
  faint: string
  dim: string
  accent: string
  /** Text and icons on an `accent` fill. */
  onAccent: string
  accentTint: string
  accentSurface: string
  accentBorder: string
  /** Money owed to the user. */
  owed: string
  /** Money the user owes. */
  owe: string
  /** Text on an `owe` fill (destructive confirm). */
  onOwe: string
  dangerBorder: string
  dangerFill: string
  /** The light "Settle" button. */
  contrast: string
  contrastText: string
  segment: string
  skeleton: string
  /** Text on the fixed group and category colour fills. */
  onFill: string
}

export const dark: Colors = {
  bg: '#0C0D10',
  bgSidebar: '#111216',
  surface: '#16171C',
  surface2: '#1D1F25',
  field: '#0F1014',
  border: '#24262D',
  borderStrong: '#33353D',
  divider: '#22242A',
  text: '#F2F2EE',
  text2: '#D6D7DC',
  muted: '#A0A2AB',
  faint: '#8A8D96',
  dim: '#6E717B',
  accent: '#B18CFF',
  onAccent: '#0C0D10',
  accentTint: 'rgba(177,140,255,0.12)',
  accentSurface: '#1B1726',
  accentBorder: '#3D2F63',
  owed: '#7CB8FF',
  owe: '#FF9B6A',
  onOwe: '#0C0D10',
  dangerBorder: '#5A3626',
  dangerFill: 'rgba(255,155,106,0.08)',
  contrast: '#F2F2EE',
  contrastText: '#0C0D10',
  segment: '#2A2C33',
  skeleton: '#1D1F25',
  onFill: '#0C0D10',
}

export const light: Colors = {
  bg: '#F6F6F3',
  bgSidebar: '#EFEFEB',
  surface: '#FFFFFF',
  surface2: '#F0F0EC',
  field: '#FAFAF8',
  border: '#E2E2DC',
  borderStrong: '#D0D0C9',
  divider: '#E8E8E3',
  text: '#15161A',
  text2: '#3C3E46',
  muted: '#5F626B',
  faint: '#7C7F88',
  dim: '#85888F',
  accent: '#6A3FDB',
  onAccent: '#FFFFFF',
  accentTint: 'rgba(106,63,219,0.10)',
  accentSurface: '#F1EBFF',
  accentBorder: '#CDBCF6',
  owed: '#1F6FD1',
  owe: '#C2531B',
  onOwe: '#FFFFFF',
  dangerBorder: '#ECC3AB',
  dangerFill: 'rgba(194,83,27,0.06)',
  contrast: '#15161A',
  contrastText: '#F6F6F3',
  segment: '#FFFFFF',
  skeleton: '#E9E9E4',
  onFill: '#0C0D10',
}

/** Fixed fills that look the same in both themes. */
export const groupColors = ['#5FD3A0', '#F28DB2', '#F2C14E', '#7CB8FF', '#B18CFF', '#FF9B6A']
export const avatarFills = ['#2B3A55', '#4D4326', '#23463A', '#55332A', '#37305A']

export const radius = {
  /** Progress bars. */
  bar: 2,
  chip: 8,
  /** Buttons and inputs (12-13px in the Android mocks). */
  control: 13,
  /** Icon tiles in rows. */
  icon: 12,
  fab: 16,
  tile: 18,
  card: 20,
} as const

export const space = {
  /** Side gutter of every screen. */
  gutter: 20,
  /** Between cards. */
  gap: 18,
} as const

/**
 * Android ignores `fontWeight` for custom fonts, so each weight is its own
 * family (the names `useFonts` registers in `src/app/_layout.tsx`).
 */
export const fonts = {
  sans: {
    400: 'Geist_400Regular',
    500: 'Geist_500Medium',
    600: 'Geist_600SemiBold',
    700: 'Geist_700Bold',
  },
  mono: {
    400: 'GeistMono_400Regular',
    500: 'GeistMono_500Medium',
    600: 'GeistMono_600SemiBold',
    700: 'GeistMono_600SemiBold',
  },
} as const

export type FontWeight = keyof typeof fonts.sans
