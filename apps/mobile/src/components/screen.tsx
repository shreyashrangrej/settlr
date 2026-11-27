import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { IconButton } from '@/components/button'
import { Icons } from '@/components/icons'
import { Text, Title } from '@/components/text'
import { useColors } from '@/theme'

/** Space under a tab's content so the floating bar never covers it. */
export const TAB_BAR_SPACE = 104

/**
 * A scrolling page on the ground colour, starting under the status bar.
 * `tab` leaves room for the floating bottom bar; `footer` pins a bar of
 * buttons to the bottom.
 */
export function Screen({
  children,
  tab = false,
  footer,
  background,
  refreshing,
  onRefresh,
  contentStyle,
  scroll = true,
  ...scrollProps
}: {
  children: ReactNode
  tab?: boolean
  footer?: ReactNode
  background?: string
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
  scroll?: boolean
} & ScrollViewProps) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const bg = background ?? colors.bg
  const bottom = tab ? insets.bottom + TAB_BAR_SPACE : footer ? 16 : insets.bottom + 28
  return (
    <View style={[styles.flex, { backgroundColor: bg }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingTop: insets.top + 4, paddingBottom: bottom }, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
                progressViewOffset={insets.top}
              />
            ) : undefined
          }
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, { paddingTop: insets.top + 4 }, contentStyle]}>{children}</View>
      )}
      {scroll ? <StatusBarScrim color={bg} /> : null}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: bg, paddingBottom: insets.bottom + 14 }]}>{footer}</View>
      ) : null}
    </View>
  )
}

/** How far the scrim fades out below the status bar. */
const SCRIM_FADE = 14

/**
 * The status bar is see-through (Android draws apps edge to edge), so a
 * page that scrolls would slide its content under the clock and icons.
 * This paints the page's colour behind the status bar, fading out just
 * below it, so content scrolls away under a clean strip. Put it last in a
 * full-screen container whose content scrolls.
 */
export function StatusBarScrim({ color }: { color: string }) {
  const insets = useSafeAreaInsets()
  if (insets.top === 0) return null
  return (
    <View pointerEvents="none" style={[styles.scrim, { height: insets.top + SCRIM_FADE }]}>
      <View style={{ height: insets.top, backgroundColor: color }} />
      <Svg width="100%" height={SCRIM_FADE}>
        <Defs>
          <LinearGradient id="statusBarFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={SCRIM_FADE} fill="url(#statusBarFade)" />
      </Svg>
    </View>
  )
}

/** A tab's header: the big title and its icon buttons. */
export function TabHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <View style={styles.tabHeader}>
      <Title style={styles.flex} numberOfLines={1}>
        {title}
      </Title>
      {actions}
    </View>
  )
}

/** The 60px top bar of a pushed page: back (or close), a title, actions. */
export function TopBar({
  title,
  actions,
  close = false,
  onBack,
  backLabel,
}: {
  title?: string
  actions?: ReactNode
  close?: boolean
  onBack?: () => void
  backLabel?: string
}) {
  const router = useRouter()
  const colors = useColors()
  const back = () => {
    if (onBack) onBack()
    else if (router.canGoBack()) router.back()
    else router.replace('/')
  }
  return (
    <View style={styles.topbar}>
      <IconButton
        icon={close ? Icons.x : Icons.back}
        label={backLabel ?? (close ? 'Close' : 'Back')}
        onPress={back}
        color={colors.text}
      />
      <Text weight={800} size={18} lineHeight={24} tracking={-0.01} numberOfLines={1} style={styles.topTitle}>
        {title ?? ''}
      </Text>
      {actions}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 64,
    paddingLeft: 20,
    paddingRight: 12,
  },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 60, paddingHorizontal: 8 },
  topTitle: { flex: 1, paddingLeft: 4 },
})
