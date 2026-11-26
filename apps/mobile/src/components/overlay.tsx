import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { Sub, Text } from '@/components/text'
import { Tile } from '@/components/tiles'
import { useColors, useIsDark, useReduceMotion } from '@/theme'

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/**
 * A bottom sheet over a scrim: 32px top corners, a grab handle you can drag
 * down to close, lifted above the keyboard.
 */
export function Sheet({
  open,
  onClose,
  children,
  height,
  label,
}: {
  open: boolean
  onClose: () => void
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
  const y = useRef(new Animated.Value(screen)).current
  const fade = useRef(new Animated.Value(0)).current
  const drag = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      setMounted(true)
      drag.setValue(0)
      y.setValue(screen * 0.36)
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: reduce ? 0 : 480, easing: EASE, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 280, useNativeDriver: true }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(y, { toValue: screen, duration: reduce ? 0 : 260, easing: EASE, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: reduce ? 0 : 220, useNativeDriver: true }),
      ]).start(() => setMounted(false))
    }
    // `mounted` is read, not watched: closing starts from the open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.2) onCloseRef.current()
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start()
      },
    }),
  ).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  if (!mounted) return null
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: fade }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
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
