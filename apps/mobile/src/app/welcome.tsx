import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { GoogleIcon, Icons, Mark } from '@/components/icons'
import { Text } from '@/components/text'
import { errorMessage, signInWithGoogle } from '@/lib/auth-client'
import { useColors, useReduceMotion } from '@/theme'

/** The first screen signed out: the violet hero with floating balance chips. */
export default function WelcomeScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The art is drawn on the mocks' 412×470 board and scaled to fit the
  // phone, leaving about 420px for the words and buttons below it.
  const { width, height } = useWindowDimensions()
  const scale = Math.min(1, width / 412, (height - insets.top - insets.bottom - 420) / 470)
  const lost = (470 * (1 - scale)) / 2

  // On success the session changes and the root layout swaps to the tabs.
  async function google() {
    setPending(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.hero, paddingTop: insets.top, paddingBottom: insets.bottom + 18 }]}>
      <View style={[styles.art, { transform: [{ scale }], marginVertical: -lost }]}>
        <Spin style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />
        <View style={styles.logo}>
          <Mark size={58} tile="#FFFFFF" stroke="#5B3DF5" />
        </View>
        <Bob delay={0} style={{ left: 18, top: 46 }}>
          <Pill avatar="PS" avatarBg="#FBEFCF" avatarFg="#835500" text="Priya paid ₹6,200" />
        </Bob>
        <Bob delay={600} style={{ right: 16, top: 128 }}>
          <Pill icon text="you get back " accent="₹3,410" />
        </Bob>
        <Bob delay={1200} style={{ left: 30, top: 306 }}>
          <Pill avatar="RK" avatarBg="#DFEAFD" avatarFg="#1F57C3" text="₹1,240 each, 5 ways" />
        </Bob>
        <Bob delay={300} style={{ right: 40, top: 360 }}>
          <View style={styles.square}>
            <Icons.check color={colors.onHero} size={15} />
            <Text weight={800} size={13.5} color={colors.onHero}>
              All square
            </Text>
          </View>
        </Bob>
      </View>

      <View style={styles.body}>
        <Text accessibilityRole="header" display weight={800} size={50} lineHeight={52} tracking={-0.045} color={colors.onHero}>
          {'Split costs.\nStay friends.'}
        </Text>
        <Text weight={500} size={16} lineHeight={24} color={colors.heroDim} style={{ marginTop: 14 }}>
          Trips, flats and dinners: add what you spent, see who owes whom, and settle up in the fewest payments.
        </Text>
        <View style={styles.flex} />
        {error ? (
          <Text weight={700} size={14} color="#FFD7D2" style={{ marginBottom: 10 }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button
          wide
          size="lg"
          icon={() => <GoogleIcon />}
          colors={{ bg: '#FFFFFF', fg: '#121218' }}
          onPress={google}
          loading={pending}
          style={{ height: 56 }}
        >
          Continue with Google
        </Button>
        <Button
          wide
          size="lg"
          icon={Icons.mail}
          colors={{ bg: 'transparent', fg: colors.onHero, border: 'rgba(255,255,255,0.35)' }}
          onPress={() => router.push('/sign-in')}
          style={{ marginTop: 10 }}
        >
          Continue with email
        </Button>
        <Text weight={500} size={12} align="center" color={colors.heroDim} style={{ marginTop: 14 }}>
          No passwords. We'll send a 6-digit code.
        </Text>
      </View>
    </View>
  )
}

function Pill({
  avatar,
  avatarBg,
  avatarFg,
  icon,
  text,
  accent,
}: {
  avatar?: string
  avatarBg?: string
  avatarFg?: string
  icon?: boolean
  text: string
  accent?: string
}) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillAvatar, { backgroundColor: icon ? '#DFF3E8' : avatarBg }]}>
        {icon ? (
          <Icons.in color="#0B7F4E" size={15} />
        ) : (
          <Text weight={800} size={12} color={avatarFg}>
            {avatar}
          </Text>
        )}
      </View>
      <Text weight={700} size={13.5} color="#121218">
        {text}
        {accent ? <Text weight={700} size={13.5} color="#0B7F4E">{accent}</Text> : null}
      </Text>
    </View>
  )
}

/** Floats up and down forever (still with reduced motion). */
function Bob({ delay, style, children }: { delay: number; style: object; children: React.ReactNode }) {
  const reduce = useReduceMotion()
  const y = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 2000, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [delay, reduce, y])
  return <Animated.View style={[styles.abs, style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>
}

function Spin({ style }: { style: object }) {
  const reduce = useReduceMotion()
  const turn = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduce, turn])
  return (
    <Animated.View
      style={[style, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
    />
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  abs: { position: 'absolute' },
  art: { height: 470, width: 412, alignSelf: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderStyle: 'dashed', borderWidth: 1.5 },
  ringOuter: { left: 56, top: 50, width: 300, height: 300, borderColor: 'rgba(255,255,255,0.22)' },
  ringInner: { left: 116, top: 110, width: 180, height: 180, borderColor: 'rgba(255,255,255,0.16)' },
  logo: {
    position: 'absolute',
    left: 158,
    top: 152,
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pillAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  square: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: { flex: 1, paddingHorizontal: 24 },
})
