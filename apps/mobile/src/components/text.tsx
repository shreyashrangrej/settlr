import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native'

import { fonts, useColors, type Colors, type FontWeight } from '@/theme'

type ColorToken = Exclude<keyof Colors, 'hues'>

export type TextProps = RNTextProps & {
  /** 500, 600, 700 (default) or 800. */
  weight?: FontWeight
  /** Bricolage Grotesque, for titles and big figures. */
  display?: boolean
  /** Tabular figures, for amounts. */
  tabular?: boolean
  size?: number
  lineHeight?: number
  /** A colour token (defaults to `text`), or any colour string. */
  color?: ColorToken | (string & {})
  /** Letter spacing in em, like the mocks (-0.03 for titles). */
  tracking?: number
  align?: TextStyle['textAlign']
}

/** Manrope text (or Bricolage with `display`), coloured from the theme. */
export function Text({
  weight = 600,
  display,
  tabular,
  size = 15,
  lineHeight,
  color = 'text',
  tracking,
  align,
  style,
  ...props
}: TextProps) {
  const colors = useColors()
  const base: TextStyle = {
    fontFamily: (display ? fonts.display : fonts.sans)[weight],
    fontSize: size,
    lineHeight: lineHeight ?? Math.round(size * (display ? 1.18 : 1.38)),
    color: color in colors ? (colors[color as ColorToken] as string) : color,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
    letterSpacing: tracking !== undefined ? tracking * size : undefined,
    textAlign: align,
    includeFontPadding: false,
  }
  return <RNText {...props} style={[base, style]} />
}

/** The screen title: Bricolage 700, 32/38. */
export function Title({ children, style, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      display
      weight={700}
      size={32}
      lineHeight={38}
      tracking={-0.03}
      style={style}
      {...props}
    >
      {children}
    </Text>
  )
}

/** Section headline: Manrope 750, 17/24. */
export function Headline({ children, ...props }: TextProps) {
  return (
    <Text accessibilityRole="header" weight={800} size={17} lineHeight={24} tracking={-0.01} {...props}>
      {children}
    </Text>
  )
}

/** Supporting text: 13/18 muted. */
export function Sub({ children, ...props }: TextProps) {
  return (
    <Text weight={500} size={13} lineHeight={18} color="muted" {...props}>
      {children}
    </Text>
  )
}

/** The small label above amounts: 12/16 faint. */
export function Label({ children, ...props }: TextProps) {
  return (
    <Text weight={600} size={12} lineHeight={16} color="faint" {...props}>
      {children}
    </Text>
  )
}
