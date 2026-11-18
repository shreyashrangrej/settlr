import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native'

import { fonts, textRoles, useColors, type Colors, type FontWeight } from '@/theme'

export type TextProps = RNTextProps & {
  /** 400 (default), 500, 600 or 700. */
  weight?: FontWeight
  /** Tabular figures, for numbers and amounts. */
  tabular?: boolean
  /** Font size; T3's roles are in `textRoles` (body is 16). */
  size?: number
  /** A colour token; defaults to `text`. */
  color?: keyof Colors
}

// Line heights of T3 Code's mobile type roles, by font size.
const LINE_HEIGHT: Partial<Record<number, number>> = Object.fromEntries(
  Object.values(textRoles).map((role) => [role.size, role.lineHeight]),
)

/** Text in DM Sans, coloured from the theme. */
export function Text({ weight = 400, tabular, size = 16, color = 'text', style, ...props }: TextProps) {
  const colors = useColors()
  const base: TextStyle = {
    fontFamily: fonts.sans[weight],
    fontSize: size,
    lineHeight: LINE_HEIGHT[size] ?? Math.round(size * 1.3),
    color: colors[color],
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  }
  return <RNText {...props} style={[base, style]} />
}
