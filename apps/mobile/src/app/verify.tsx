import { emailOtpVerify, OTP_LENGTH } from '@settlr/shared/schemas'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { AuthScreen, AuthTitle, FormError } from '@/components/auth-screen'
import { Button } from '@/components/button'
import { BackIcon } from '@/components/icons'
import { Text } from '@/components/text'
import { errorMessage, sendEmailOtp, verifyEmailOtp } from '@/lib/auth-client'
import { radius, useColors } from '@/theme'

const RESEND_COOLDOWN_S = 30

/** The 6-digit code screen, after sign-in.tsx sent a code to `email`. */
export default function VerifyScreen() {
  const colors = useColors()
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

  return (
    <AuthScreen
      top={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change email"
          onPress={back}
          hitSlop={8}
          style={styles.back}
        >
          <BackIcon color={colors.text} />
        </Pressable>
      }
    >
      <AuthTitle
        title="Check your email"
        subtitle={
          <>
            Enter the {OTP_LENGTH}-digit code we sent to{' '}
            <Text size={15} weight={500}>
              {email}
            </Text>
            .
          </>
        }
      />

      <Pressable
        onPress={() => input.current?.focus()}
        accessibilityLabel={`Code, ${code.length} of ${OTP_LENGTH} digits entered`}
        style={styles.boxes}
      >
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = focused && i === Math.min(code.length, OTP_LENGTH - 1)
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.owe : active ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text mono size={24} weight={500}>
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
          style={styles.hiddenInput}
        />
      </Pressable>

      {error ? <FormError>{error}</FormError> : null}
      {notice ? (
        <Text size={14} color="muted" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <Button
        onPress={() => verify(code)}
        loading={pending === 'verify'}
        disabled={pending === 'resend' || code.length < OTP_LENGTH}
      >
        Sign in
      </Button>
      <Button
        variant="ghost"
        size="md"
        onPress={resend}
        loading={pending === 'resend'}
        disabled={resendIn > 0 || pending === 'verify'}
      >
        {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
      </Button>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  back: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Covers the boxes so taps and paste land in it, but draws nothing.
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    color: 'transparent',
  },
})
