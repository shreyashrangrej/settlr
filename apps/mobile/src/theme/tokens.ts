// Tally, the Android design language (design/android-redesign/settlr.css):
// violet ink on cool paper, Bricolage Grotesque for the figures that matter
// and Manrope for everything you read. Light and dark are two palettes, not
// an inversion. Use these tokens, not hex values.

export type Hue = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'teal' | 'rose' | 'orange' | 'gray'

export type Colors = {
  bg: string
  surface: string
  surface2: string
  surface3: string
  line: string
  divider: string
  text: string
  muted: string
  faint: string
  dim: string
  accent: string
  /** Text and icons on an `accent` fill. */
  onAccent: string
  accentSoft: string
  accentInk: string
  /** Money owed to you. */
  owed: string
  owedSoft: string
  /** Money you owe. */
  owe: string
  oweSoft: string
  onOwe: string
  warn: string
  warnSoft: string
  /** Home's balance card. */
  hero: string
  onHero: string
  heroDim: string
  heroTile: string
  /** The "contrast" fill: Settle up buttons, the selected chip, snackbars. */
  ink: string
  onInk: string
  scrim: string
  key: string
  /** The floating bottom bar. */
  nav: string
  navLine: string
  /** Label hues: tiles for categories, groups and people. */
  hues: Record<Hue, { bg: string; fg: string }>
}

export const light: Colors = {
  bg: '#F4F4F7',
  surface: '#FFFFFF',
  surface2: '#ECECF1',
  surface3: '#E0E0E8',
  line: '#E6E6ED',
  divider: '#EEEEF3',
  text: '#121218',
  muted: '#56566A',
  faint: '#69697D',
  dim: '#9C9CAE',
  accent: '#5B3DF5',
  onAccent: '#FFFFFF',
  accentSoft: '#ECE8FF',
  accentInk: '#4A2BE0',
  owed: '#0B7F4E',
  owedSoft: '#DFF3E8',
  owe: '#D33A2C',
  oweSoft: '#FCE6E2',
  onOwe: '#FFFFFF',
  warn: '#8F5D00',
  warnSoft: '#FBF0D6',
  hero: '#5B3DF5',
  onHero: '#FFFFFF',
  heroDim: 'rgba(255,255,255,0.8)',
  heroTile: 'rgba(255,255,255,0.14)',
  ink: '#121218',
  onInk: '#FFFFFF',
  scrim: 'rgba(14,12,28,0.46)',
  key: '#ECECF1',
  nav: 'rgba(255,255,255,0.94)',
  navLine: 'rgba(20,18,40,0.07)',
  hues: {
    green: { bg: '#DDF3E6', fg: '#13703F' },
    amber: { bg: '#FBEFCF', fg: '#835500' },
    red: { bg: '#FBE2DE', fg: '#B0302A' },
    blue: { bg: '#DFEAFD', fg: '#1F57C3' },
    violet: { bg: '#E9E4FE', fg: '#5232D6' },
    teal: { bg: '#D9F1F0', fg: '#0E6964' },
    rose: { bg: '#FCE1EB', fg: '#AD2A5C' },
    orange: { bg: '#FDE6D6', fg: '#AD480D' },
    gray: { bg: '#E9E9EE', fg: '#4F4F60' },
  },
}

export const dark: Colors = {
  bg: '#0E0E13',
  surface: '#17171F',
  surface2: '#21212B',
  surface3: '#2C2C38',
  line: '#262631',
  divider: '#22222C',
  text: '#F1F1F6',
  muted: '#ABABBE',
  faint: '#8E8EA3',
  dim: '#5E5E70',
  accent: '#B18CFF',
  onAccent: '#140F26',
  accentSoft: '#2A2250',
  accentInk: '#CDB7FF',
  owed: '#4FD597',
  owedSoft: '#14301F',
  owe: '#FF7D70',
  oweSoft: '#3A1916',
  onOwe: '#1A0C0A',
  warn: '#E5B04A',
  warnSoft: '#33270F',
  hero: '#2B2160',
  onHero: '#F4F0FF',
  heroDim: 'rgba(244,240,255,0.74)',
  heroTile: 'rgba(255,255,255,0.08)',
  ink: '#F1F1F6',
  onInk: '#0E0E13',
  scrim: 'rgba(0,0,0,0.62)',
  key: '#1E1E27',
  nav: 'rgba(33,33,43,0.96)',
  navLine: 'rgba(255,255,255,0.08)',
  hues: {
    green: { bg: '#183526', fg: '#7FDCA6' },
    amber: { bg: '#3A2E12', fg: '#F2C46B' },
    red: { bg: '#3E1C1A', fg: '#FF9A8F' },
    blue: { bg: '#1A2A47', fg: '#8DB4FF' },
    violet: { bg: '#28214D', fg: '#B9ABFF' },
    teal: { bg: '#133836', fg: '#74D8D1' },
    rose: { bg: '#3E1A2A', fg: '#FF92B9' },
    orange: { bg: '#3E2414', fg: '#FFAA73' },
    gray: { bg: '#26262F', fg: '#B9B9C8' },
  },
}

/** Pills for buttons and chips, 32 sheets, 24 cards, 18 fields, 15 tiles. */
export const radius = {
  pill: 999,
  sheet: 32,
  hero: 28,
  card: 24,
  field: 18,
  tile: 15,
} as const

/** 16px screen gutter; sections sit 26px apart. */
export const space = { gutter: 16 } as const

/**
 * Manrope for text and Bricolage Grotesque for display figures. Android
 * ignores `fontWeight` for custom fonts, so every weight is its own family
 * (the names `useFonts` registers in `src/app/_layout.tsx`).
 */
export const fonts = {
  sans: {
    500: 'Manrope_500Medium',
    600: 'Manrope_600SemiBold',
    700: 'Manrope_700Bold',
    800: 'Manrope_800ExtraBold',
  },
  display: {
    500: 'BricolageGrotesque_600SemiBold',
    600: 'BricolageGrotesque_600SemiBold',
    700: 'BricolageGrotesque_700Bold',
    800: 'BricolageGrotesque_800ExtraBold',
  },
} as const

export type FontWeight = keyof typeof fonts.sans

/** The card shadow from the mocks (light only; dark cards sit flat). */
export function cardShadow(isDark: boolean) {
  return isDark
    ? {}
    : {
        shadowColor: '#141228',
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }
}
