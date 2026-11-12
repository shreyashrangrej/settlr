import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native'

import { fonts, useColors, type Colors, type FontWeight } from '@/theme'

export type TextProps = RNTextProps & {
  /** 400 (default), 500, 600 or 700. */
  weight?: FontWeight
  /** Geist Mono with tabular figures, for numbers and amounts. */
  mono?: boolean
  size?: number
  /** A colour token; defaults to `text`. */
  color?: keyof Colors
}

/** Text in Geist (or Geist Mono), coloured from the theme. */
export function Text({ weight = 400, mono, size = 15, color = 'text', style, ...props }: TextProps) {
  const colors = useColors()
  const base: TextStyle = {
    fontFamily: (mono ? fonts.mono : fonts.sans)[weight],
    fontSize: size,
    lineHeight: Math.round(size * 1.35),
    color: colors[color],
    fontVariant: mono ? ['tabular-nums'] : undefined,
  }
  return <RNText {...props} style={[base, style]} />
}
