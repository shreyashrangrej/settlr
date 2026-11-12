import { emailOtpRequest } from '@settlr/shared/schemas'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { AuthScreen, AuthTitle, FormError } from '@/components/auth-screen'
import { Brand } from '@/components/brand'
import { Button } from '@/components/button'
import { GoogleIcon } from '@/components/icons'
import { Text } from '@/components/text'
import { errorMessage, sendEmailOtp, signInWithGoogle } from '@/lib/auth-client'
import { fonts, radius, useColors } from '@/theme'

export default function SignInScreen() {
  const colors = useColors()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [focused, setFocused] = useState(false)
  const [pending, setPending] = useState<'send' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function requestCode() {
    const parsed = emailOtpRequest.safeParse({ email: email.trim() })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address')
      return
    }
    setPending('send')
    setError(null)
    try {
      await sendEmailOtp(parsed.data.email)
      router.push({ pathname: '/verify', params: { email: parsed.data.email } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  // On success the session changes and the root layout swaps to the tabs.
  async function google() {
    setPending('google')
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  return (
    <AuthScreen top={<Brand />}>
      <AuthTitle title="Sign in" subtitle="We'll email you a 6-digit code." />

      <View style={styles.field}>
        <Text nativeID="email-label" size={13} weight={500} color="muted">
          Email
        </Text>
        <TextInput
          accessibilityLabelledBy="email-label"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={requestCode}
          placeholder="you@example.com"
          placeholderTextColor={colors.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          editable={pending === null}
          selectionColor={colors.accent}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.owe : focused ? colors.accent : colors.borderStrong,
              color: colors.text,
            },
          ]}
        />
      </View>

      {error ? <FormError>{error}</FormError> : null}

      <Button onPress={requestCode} loading={pending === 'send'} disabled={pending === 'google'}>
        Send code
      </Button>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.divider }]} />
        <Text size={13} color="faint">
          or
        </Text>
        <View style={[styles.line, { backgroundColor: colors.divider }]} />
      </View>

      <Button
        variant="outline"
        icon={<GoogleIcon color={colors.text} />}
        onPress={google}
        loading={pending === 'google'}
        disabled={pending === 'send'}
      >
        Continue with Google
      </Button>
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8, marginTop: 14 },
  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radius.control,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: fonts.sans[400],
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 8 },
  line: { flex: 1, height: 1 },
})
