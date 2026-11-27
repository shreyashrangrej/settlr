import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { ripple } from '@/components/ripple'
import { Sub, Text } from '@/components/text'
import { Tile } from '@/components/tiles'
import { useColors, useIsDark, useReduceMotion } from '@/theme'

/**
 * Sheets rise on a spring (no overshoot, so the bottom edge never lifts off
 * the screen): fast to start, soft to land, and it carries the speed of a
 * drag. About 250ms to look settled.
 */
const RISE = { stiffness: 340, damping: 36, mass: 1, overshootClamping: true, useNativeDriver: true } as const
/** Leaving accelerates away (Material's emphasized accelerate). */
const LEAVE = Easing.bezier(0.3, 0, 0.8, 0.15)
export const SHEET_CLOSE_MS = 200

/**
 * A bottom sheet over a scrim: 32px top corners, a grab handle you can drag
 * down to close, lifted above the keyboard. It rises from just below its own
 * height (measured on first layout), so it moves from the first frame.
 * `onClosed` runs once it has slid away, e.g. to leave a sheet's route.
 */
export function Sheet({
  open,
  onClose,
  onClosed,
  children,
  height,
  label,
}: {
  open: boolean
  onClose: () => void
  onClosed?: () => void
  children: ReactNode
  /** Fraction of the screen (0–1), or leave out to fit the content. */
  height?: number
  label?: string
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const { height: screen } = useWindowDimensions()
  const reduce = useReduceMotion()
  const [mounted, setMounted] = useState(open)
  const [sheetHeight, setSheetHeight] = useState(screen)
  const y = useRef(new Animated.Value(screen)).current
  const fade = useRef(new Animated.Value(0)).current
  const drag = useRef(new Animated.Value(0)).current
  const measured = useRef(0)
  const waiting = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  // Off-screen: just past the sheet's own height (plus its shadow).
  const below = () => (measured.current || screen) + 32

  function rise(velocity = 0) {
    waiting.current = false
    if (reduce) {
      y.setValue(0)
      fade.setValue(1)
      return
    }
    y.setValue(below())
    Animated.parallel([
      Animated.spring(y, { ...RISE, toValue: 0, velocity }),
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start()
  }

  useEffect(() => {
    if (open) {
      drag.setValue(0)
      // Already laid out (reopened while closing): rise now; otherwise
      // wait for the first layout to know how far to travel.
      if (mounted && measured.current) rise()
      else {
        waiting.current = true
        y.setValue(screen)
        setMounted(true)
      }
    } else if (mounted) {
      waiting.current = false
      const duration = reduce ? 0 : SHEET_CLOSE_MS
      Animated.parallel([
        Animated.timing(y, { toValue: below(), duration, easing: LEAVE, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return
        setMounted(false)
        onClosedRef.current?.()
      })
    }
    // `mounted` is read, not watched: closing starts from the open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        const h = measured.current || screen
        // A flick, or past a third of the way down, closes it.
        if (g.vy > 0.9 || g.dy > Math.min(160, h / 3)) onCloseRef.current()
        else Animated.spring(drag, { ...RISE, toValue: 0, velocity: -g.vy }).start()
      },
      onPanResponderTerminate: () => Animated.spring(drag, { ...RISE, toValue: 0 }).start(),
    }),
  ).current

  if (!mounted) return null
  // The scrim lightens as the sheet is dragged down.
  const scrimOpacity = Animated.multiply(
    fade,
    drag.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0.15], extrapolate: 'clamp' }),
  )
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: scrimOpacity }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height
            measured.current = h
            if (Math.abs(h - sheetHeight) > 1) setSheetHeight(h)
            if (waiting.current) rise()
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 12,
              maxHeight: screen - insets.top - 24,
              height: height ? Math.min(screen * height, screen - insets.top - 24) : undefined,
              transform: [{ translateY: Animated.add(y, drag) }],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.grabArea}>
            <View style={[styles.grab, { backgroundColor: colors.surface3 }]} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** The part of a stack screen's navigation that `SheetPage` uses. */
type RemovableScreen = {
  addListener: (
    type: 'beforeRemove',
    listener: (e: { data: { action: { type: string } }; preventDefault: () => void }) => void,
  ) => () => void
  dispatch: (action: { type: string }) => void
}

/**
 * A full-screen page that comes up like a sheet (Add expense, New group).
 * Its route is a `transparentModal` with no native animation, so the page
 * below stays in view: this springs the page up over a fading scrim, and
 * on Back (the close button, the system back, `router.back()`) slides it
 * down before the route goes. Other ways of leaving (replace, dismiss) are
 * left alone, since they navigate on at once.
 */
export function SheetPage({ children }: { children: ReactNode }) {
  const colors = useColors()
  const navigation = useNavigation<RemovableScreen>()
  const { height: screen } = useWindowDimensions()
  const reduce = useReduceMotion()
  const y = useRef(new Animated.Value(reduce ? 0 : screen)).current
  const leaving = useRef(false)
  // Taps are off while it slides away (so Add can't be pressed twice).
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!reduce) Animated.spring(y, { ...RISE, toValue: 0 }).start()
    // Rises once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leaving.current || reduce || e.data.action.type !== 'GO_BACK') return
        e.preventDefault()
        leaving.current = true
        setGone(true)
        Animated.timing(y, { toValue: screen, duration: SHEET_CLOSE_MS + 20, easing: LEAVE, useNativeDriver: true }).start(() =>
          navigation.dispatch(e.data.action),
        )
      }),
    [navigation, reduce, screen, y],
  )

  return (
    <View style={styles.flex}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.scrim,
            opacity: y.interpolate({ inputRange: [0, screen], outputRange: [1, 0], extrapolate: 'clamp' }),
          },
        ]}
      />
      <Animated.View
        pointerEvents={gone ? 'none' : 'auto'}
        style={[styles.flex, styles.page, { transform: [{ translateY: y }] }]}
      >
        {children}
      </Animated.View>
    </View>
  )
}

/** A sheet's big title: Bricolage 750, 26/32. */
export function SheetTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <View style={styles.sheetTitle}>
      {kicker ? (
        <Text weight={600} size={12} color="faint">
          {kicker}
        </Text>
      ) : null}
      <Text accessibilityRole="header" display weight={700} size={26} lineHeight={32} tracking={-0.025}>
        {children}
      </Text>
    </View>
  )
}

// ---------- Snackbar ----------

type Toast = { id: number; message: string; icon?: IconComponent; tone?: 'good' | 'bad'; action?: { label: string; onPress: () => void } }

let toastState: Toast | null = null
const toastListeners = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** Shows a snackbar for 4 seconds: "Expense added to Goa Trip · View". */
export function toast(message: string, options: Omit<Toast, 'id' | 'message'> = {}) {
  toastState = { id: Date.now(), message, ...options }
  toastListeners.forEach((l) => l())
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastState = null
    toastListeners.forEach((l) => l())
  }, options.action ? 6000 : 4000)
}

function dismissToast() {
  toastState = null
  toastListeners.forEach((l) => l())
}

/** The snackbar, rising over the bottom bar. Rendered once in the root layout. */
export function ToastHost() {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const current = useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => toastListeners.delete(l)
    },
    () => toastState,
  )
  const rise = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (current) {
      rise.setValue(0)
      Animated.spring(rise, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start()
    }
  }, [current, rise])
  if (!current) return null
  const Icon = current.icon ?? (current.tone === 'bad' ? Icons.alert : Icons.check)
  const iconColor = current.tone === 'bad' ? (isDark ? '#B0302A' : '#FF9A8F') : isDark ? '#0B7F4E' : '#4FD597'
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrap,
        {
          bottom: insets.bottom + 92,
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.ink }]}>
        <Icon color={iconColor} size={18} />
        <Text weight={600} size={14} color="onInk" style={styles.grow}>
          {current.message}
        </Text>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              current.action?.onPress()
              dismissToast()
            }}
            hitSlop={10}
            android_ripple={ripple(colors.onInk, { borderless: true, radius: 28, strength: 0.2 })}
            style={styles.toastAction}
          >
            <Text weight={800} size={14} color={isDark ? '#4A2BE0' : '#CDB7FF'}>
              {current.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  )
}

// ---------- Confirm dialog ----------

type Dialog = {
  title: string
  body?: string
  confirm: string
  destructive?: boolean
  icon?: IconComponent
  resolve: (ok: boolean) => void
}

let dialogState: Dialog | null = null
const dialogListeners = new Set<() => void>()

/** Asks before something that can't be taken back; resolves true to go ahead. */
export function confirm(options: Omit<Dialog, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    dialogState = { ...options, resolve }
    dialogListeners.forEach((l) => l())
  })
}

function closeDialog(ok: boolean) {
  dialogState?.resolve(ok)
  dialogState = null
  dialogListeners.forEach((l) => l())
}

export function DialogHost() {
  const colors = useColors()
  const current = useSyncExternalStore(
    (l) => {
      dialogListeners.add(l)
      return () => dialogListeners.delete(l)
    },
    () => dialogState,
  )
  if (!current) return null
  const Icon = current.icon ?? (current.destructive ? Icons.trash : Icons.alert)
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => closeDialog(false)}>
      <View style={[styles.dialogWrap, { backgroundColor: colors.scrim }]}>
        <View accessibilityRole="alert" style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Tile
            size={44}
            bg={current.destructive ? colors.oweSoft : colors.accentSoft}
            fg={current.destructive ? colors.owe : colors.accentInk}
            icon={Icon}
          />
          <Text accessibilityRole="header" weight={800} size={17} lineHeight={24} style={{ marginTop: 12 }}>
            {current.title}
          </Text>
          {current.body ? (
            <Sub size={14} lineHeight={20} style={{ marginTop: 6 }}>
              {current.body}
            </Sub>
          ) : null}
          <View style={styles.dialogButtons}>
            <Button variant="neutral" size="md" style={styles.grow} onPress={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={current.destructive ? 'danger' : 'primary'}
              size="md"
              style={styles.grow}
              onPress={() => closeDialog(true)}
            >
              {current.confirm}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, elevation: 24 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 24,
  },
  grabArea: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3 },
  sheetTitle: { paddingHorizontal: 20, paddingTop: 8, gap: 2 },
  grow: { flex: 1 },
  toastWrap: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 18,
    minHeight: 50,
  },
  toastAction: { paddingHorizontal: 8, paddingVertical: 4 },
  dialogWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 28, padding: 20 },
  dialogButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
})
