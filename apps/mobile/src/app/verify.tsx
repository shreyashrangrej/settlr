import { emailOtpVerify, OTP_LENGTH } from '@settlr/shared/schemas'
import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Chip } from '@/components/controls'
import { Icons } from '@/components/icons'
import { StatusBarScrim, TopBar } from '@/components/screen'
import { Rise } from '@/components/surfaces'
import { Sub, Text, Title } from '@/components/text'
import { errorMessage, sendEmailOtp, verifyEmailOtp } from '@/lib/auth-client'
import { cardShadow, useColors, useIsDark } from '@/theme'

const RESEND_COOLDOWN_S = 30

/** The 6-digit code screen, after sign-in.tsx sent a code to `email`. */
export default function VerifyScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { email = '' } = useLocalSearchParams<{ email?: string }>()
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(true)
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_S)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  function back() {
    if (router.canGoBack()) router.back()
    else router.replace('/sign-in')
  }

  // On success the session changes and the root layout swaps to the tabs.
  async function verify(otp: string) {
    const parsed = emailOtpVerify.safeParse({ email, otp })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `Enter the ${OTP_LENGTH}-digit code`)
      return
    }
    setPending('verify')
    setError(null)
    setNotice(null)
    try {
      await verifyEmailOtp(parsed.data.email, parsed.data.otp)
    } catch (err) {
      setError(errorMessage(err))
      setCode('')
      input.current?.focus()
    } finally {
      setPending(null)
    }
  }

  async function resend() {
    setPending('resend')
    setError(null)
    setNotice(null)
    try {
      await sendEmailOtp(email)
      setCode('')
      setResendIn(RESEND_COOLDOWN_S)
      setNotice('We sent a new code.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setCode(digits)
    if (error) setError(null)
    if (digits.length === OTP_LENGTH) verify(digits)
  }

  async function paste() {
    const text = await Clipboard.getStringAsync()
    const digits = text.replace(/\D/g, '')
    if (digits.length >= OTP_LENGTH) onChange(digits)
    else setError(`There's no ${OTP_LENGTH}-digit code on the clipboard.`)
  }

  // Opened without an email (signing out lands on the first signed-out
  // screen): there's no code to check, so start at Welcome.
  if (!email) return <Redirect href="/welcome" />

  const cursor = Math.min(code.length, OTP_LENGTH - 1)
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]}
      >
        <TopBar onBack={back} backLabel="Change email" />
        <Rise index={1} style={styles.pad}>
          <Title>Check your inbox</Title>
          <Sub size={15} lineHeight={22} style={{ marginTop: 8 }}>
            We sent a {OTP_LENGTH}-digit code to{' '}
            <Text weight={800} size={15}>
              {email}
            </Text>
            .{' '}
            <Text weight={700} size={15} color="accentInk" onPress={back}>
              Change
            </Text>
          </Sub>
        </Rise>

        <Rise index={2} style={[styles.pad, { paddingTop: 32 }]}>
          <Pressable
            onPress={() => input.current?.focus()}
            accessibilityLabel={`One-time code, ${code.length} of ${OTP_LENGTH} digits entered`}
            style={styles.boxes}
          >
            {Array.from({ length: OTP_LENGTH }, (_, i) => {
              const filled = i < code.length
              const active = focused && i === cursor && pending !== 'verify'
              return (
                <View
                  key={i}
                  style={[
                    styles.box,
                    filled || active ? [{ backgroundColor: colors.surface }, cardShadow(isDark)] : { backgroundColor: colors.surface2 },
                    active && { borderWidth: 2, borderColor: error ? colors.owe : colors.accent },
                  ]}
                >
                  <Text display weight={700} size={30} lineHeight={36} tabular>
                    {code[i] ?? ''}
                  </Text>
                </View>
              )
            })}
            <TextInput
              ref={input}
              value={code}
              onChangeText={onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              editable={pending !== 'verify'}
              caretHidden
              accessibilityLabel="One-time code"
              style={styles.hiddenInput}
            />
          </Pressable>
        </Rise>

        <Rise index={3} style={[styles.pad, styles.tools]}>
          <Chip tone="accent" icon={Icons.copy} onPress={paste}>
            Paste code
          </Chip>
          {resendIn > 0 ? (
            <Sub>Resend in 0:{String(resendIn).padStart(2, '0')}</Sub>
          ) : (
            <Chip tone="line" onPress={resend}>
              {pending === 'resend' ? 'Sending…' : 'Send a new code'}
            </Chip>
          )}
        </Rise>
        {error ? (
          <Text weight={600} size={14} color="owe" style={[styles.pad, { marginTop: 14 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Sub size={14} style={[styles.pad, { marginTop: 14 }]} accessibilityLiveRegion="polite">
            {notice}
          </Sub>
        ) : null}

        <View style={styles.flex} />
        <View style={[styles.pad, { paddingTop: 24 }]}>
          <Button wide onPress={() => verify(code)} loading={pending === 'verify'} disabled={pending === 'resend' || code.length < OTP_LENGTH} style={{ height: 56 }}>
            Verify and continue
          </Button>
          <Sub align="center" size={12.5} style={{ marginTop: 12 }}>
            The code fills in by itself when you copy it from the email.
          </Sub>
        </View>
      </ScrollView>
      <StatusBarScrim color={colors.bg} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  pad: { paddingHorizontal: 24 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Covers the boxes so taps and paste land in it, but draws nothing.
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0, color: 'transparent' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 20 },
})
