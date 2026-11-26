import type { Category } from '@settlr/shared/schemas'
import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { CATEGORY_ICON, Icons, type IconComponent } from '@/components/icons'
import { Text } from '@/components/text'
import { CATEGORY_HUE } from '@/lib/category'
import { initials, toneFor } from '@/lib/format'
import { useMe } from '@/lib/me'
import { useColors, type Hue } from '@/theme'

const AVATAR = { xs: [26, 10.5], sm: [32, 12], md: [44, 15], lg: [76, 26], xl: [60, 19] } as const
export type AvatarSize = keyof typeof AVATAR

/** A person's initials on their label hue; you are solid violet. */
export function Avatar({
  name,
  id,
  me = false,
  size = 'md',
  ring,
  style,
}: {
  name: string
  /** Picks the hue; defaults to the name. */
  id?: string
  me?: boolean
  size?: AvatarSize
  /** A 2.5px ring in this colour, for overlapping stacks. */
  ring?: string
  style?: StyleProp<ViewStyle>
}) {
  const colors = useColors()
  const self = useMe()
  const [box, font] = AVATAR[size]
  // You are always your own initials, even where you're labelled "You".
  const label = me ? self.name || self.email || name : name
  const hue = colors.hues[toneFor(id ?? name)]
  const bg = me ? colors.accent : hue.bg
  const fg = me ? colors.onAccent : hue.fg
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.center,
        { width: box, height: box, borderRadius: box / 2, backgroundColor: bg },
        ring ? { borderWidth: 2.5, borderColor: ring } : null,
        style,
      ]}
    >
      <Text weight={800} size={font} lineHeight={font + 4} color={fg}>
        {initials(label)}
      </Text>
    </View>
  )
}

/** Overlapping small avatars for a group's members. */
export function AvatarStack({
  people,
  ring,
  max = 5,
}: {
  people: Array<{ id: string; name: string; me?: boolean }>
  ring: string
  max?: number
}) {
  return (
    <View style={styles.row}>
      {people.slice(0, max).map((p, i) => (
        <Avatar
          key={p.id}
          id={p.id}
          name={p.name}
          me={p.me}
          size="xs"
          ring={ring}
          style={i > 0 ? { marginLeft: -8 } : null}
        />
      ))}
    </View>
  )
}

/** A rounded square with an icon or letter on a label hue. */
export function Tile({
  hue,
  size = 44,
  radius,
  bg,
  fg,
  icon: Icon,
  iconSize,
  letter,
  style,
}: {
  hue?: Hue
  size?: number
  radius?: number
  bg?: string
  fg?: string
  icon?: IconComponent
  iconSize?: number
  letter?: string
  style?: StyleProp<ViewStyle>
}) {
  const colors = useColors()
  const tone = hue ? colors.hues[hue] : { bg: colors.surface2, fg: colors.muted }
  const color = fg ?? tone.fg
  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.34), backgroundColor: bg ?? tone.bg },
        style,
      ]}
    >
      {Icon ? <Icon color={color} size={iconSize ?? Math.round(size * 0.5)} /> : null}
      {letter ? (
        <Text display weight={800} size={Math.round(size * 0.46)} lineHeight={Math.round(size * 0.56)} color={color}>
          {letter}
        </Text>
      ) : null}
    </View>
  )
}

/** A group's monogram tile. */
export function GroupTile({ id, name, size = 44, radius }: { id: string; name: string; size?: number; radius?: number }) {
  return <Tile hue={toneFor(id)} size={size} radius={radius} letter={name.trim().charAt(0).toUpperCase() || '·'} />
}

export function CategoryTile({ category, size = 44 }: { category: Category; size?: number }) {
  return <Tile hue={CATEGORY_HUE[category]} size={size} icon={Icons[CATEGORY_ICON[category]]} />
}

export type BadgeTone = 'owed' | 'owe' | 'accent' | 'neutral' | 'warn'

/** A pill label: owes you, you owe, settled, request sent. */
export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  size = 'sm',
  bg,
  fg,
}: {
  children: ReactNode
  tone?: BadgeTone
  icon?: IconComponent
  size?: 'sm' | 'md' | 'lg'
  bg?: string
  fg?: string
}) {
  const colors = useColors()
  const tones: Record<BadgeTone, [string, string]> = {
    owed: [colors.owedSoft, colors.owed],
    owe: [colors.oweSoft, colors.owe],
    accent: [colors.accentSoft, colors.accentInk],
    neutral: [colors.surface2, colors.muted],
    warn: [colors.warnSoft, colors.warn],
  }
  const [background, color] = [bg ?? tones[tone][0], fg ?? tones[tone][1]]
  const height = size === 'lg' ? 30 : size === 'md' ? 26 : 22
  const font = size === 'lg' ? 13.5 : size === 'md' ? 12.5 : 11.5
  return (
    <View style={[styles.badge, { height, paddingHorizontal: size === 'sm' ? 8 : 11, backgroundColor: background }]}>
      {Icon ? <Icon color={color} size={font + 2} strokeWidth={2.4} /> : null}
      <Text weight={800} size={font} lineHeight={font + 3} color={color} numberOfLines={1}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  row: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
  },
})
