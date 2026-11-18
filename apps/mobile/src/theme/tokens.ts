// Design tokens from design/DESIGN.md: T3 Code's design system. Dark is the
// reference theme; light is T3's light appearance. Use these, not hex
// values, except for the fixed group, category and avatar fills.

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

// T3 Code's mobile palette (apps/mobile in github.com/pingdotgg/t3code):
// a near-black screen, #111 cards, hairline borders, a blue primary, and
// T3's danger red; owed-to-you is the web app's emerald.
export const dark: Colors = {
  bg: '#0A0A0A',
  bgSidebar: '#0A0A0A',
  surface: '#111111',
  surface2: '#1A1B1B',
  field: '#111111',
  border: '#191919',
  borderStrong: '#1E1E1E',
  divider: 'rgba(25,25,25,0.55)',
  text: '#F5F5F5',
  text2: '#F5F5F5',
  muted: '#838383',
  faint: '#818181',
  dim: '#5C5C5C',
  accent: '#346BF1',
  onAccent: '#FFFFFF',
  accentTint: 'rgba(52,107,241,0.16)',
  accentSurface: '#121B34',
  accentBorder: 'rgba(52,107,241,0.42)',
  owed: '#34D399',
  owe: '#FF6467',
  onOwe: '#0A0A0A',
  dangerBorder: 'rgba(251,65,74,0.32)',
  dangerFill: '#301214',
  contrast: '#F5F5F5',
  contrastText: '#0A0A0A',
  segment: '#1A1B1B',
  skeleton: '#1A1B1B',
  onFill: '#0C0D10',
}

export const light: Colors = {
  bg: '#FCFCFC',
  bgSidebar: '#FAFAFA',
  surface: '#FFFFFF',
  surface2: '#F4F4F5',
  field: '#FFFFFF',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',
  divider: 'rgba(228,228,231,0.55)',
  text: '#27272A',
  text2: '#27272A',
  muted: '#6F6F79',
  faint: '#71717B',
  dim: '#A1A1AA',
  accent: '#1B4ED8',
  onAccent: '#FFFFFF',
  accentTint: 'rgba(27,78,216,0.10)',
  accentSurface: '#E0E6F7',
  accentBorder: 'rgba(27,78,216,0.42)',
  owed: '#007A55',
  owe: '#C10007',
  onOwe: '#FFFFFF',
  dangerBorder: 'rgba(251,44,54,0.32)',
  dangerFill: '#FCEBEC',
  contrast: '#27272A',
  contrastText: '#FCFCFC',
  segment: '#FFFFFF',
  skeleton: '#F4F4F5',
  onFill: '#0C0D10',
}

/** Fixed fills that look the same in both themes (Tailwind's 400 shades, as on the web). */
export const groupColors = ['#34D399', '#F472B6', '#FBBF24', '#60A5FA', '#A78BFA', '#FB923C']
export const avatarFills = ['#60A5FA', '#FBBF24', '#34D399', '#FB7185', '#A78BFA']

/** T3 Code's mobile shapes: pill buttons and chips, 16px fields, 20px grouped cards. */
export const radius = {
  /** Progress bars. */
  bar: 2,
  chip: 999,
  /** Buttons. */
  button: 999,
  /** Inputs and other fields. */
  control: 16,
  /** Icon tiles in rows. */
  icon: 10,
  fab: 999,
  tile: 16,
  card: 20,
} as const

export const space = {
  /** Side gutter of every screen (T3's px-4). */
  gutter: 16,
  /** Between cards and sections. */
  gap: 16,
} as const

/** T3 Code's mobile type scale: size and line height per role. */
export const textRoles = {
  micro: { size: 11, lineHeight: 14 },
  caption: { size: 12, lineHeight: 16 },
  label: { size: 13, lineHeight: 17 },
  footnote: { size: 14, lineHeight: 19 },
  body: { size: 16, lineHeight: 23 },
  headline: { size: 18, lineHeight: 23 },
  title: { size: 21, lineHeight: 28 },
  largeTitle: { size: 26, lineHeight: 32 },
  display: { size: 30, lineHeight: 36 },
} as const

/**
 * DM Sans, T3 Code's mobile typeface. Android ignores `fontWeight` for
 * custom fonts, so each weight is its own family (the names `useFonts`
 * registers in `src/app/_layout.tsx`).
 */
export const fonts = {
  sans: {
    400: 'DMSans_400Regular',
    500: 'DMSans_500Medium',
    600: 'DMSans_600SemiBold',
    700: 'DMSans_700Bold',
  },
} as const

export type FontWeight = keyof typeof fonts.sans
