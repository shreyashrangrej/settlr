import { emailOtpRequest } from '@settlr/shared/schemas'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Field } from '@/components/controls'
import { GoogleIcon, Icons } from '@/components/icons'
import { TopBar } from '@/components/screen'
import { Rise } from '@/components/surfaces'
import { Label, Sub, Title } from '@/components/text'
import { Tile } from '@/components/tiles'
import { errorMessage, sendEmailOtp, signInWithGoogle } from '@/lib/auth-client'
import { useColors } from '@/theme'

export default function SignInScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [email, setEmail] = useState('')
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
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]}
      >
        <TopBar onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
        <Rise index={1} style={styles.intro}>
          <Tile size={52} radius={18} bg={colors.accentSoft} fg={colors.accentInk} icon={Icons.mail} iconSize={24} />
          <Title style={{ marginTop: 20 }}>What's your email?</Title>
          <Sub size={15} lineHeight={22} style={{ marginTop: 8 }}>
            We'll send you a 6-digit code. New to Settlr? The same code creates your account.
          </Sub>
        </Rise>
        <Rise index={2} style={styles.field}>
          <Field
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              if (error) setError(null)
            }}
            onSubmitEditing={requestCode}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            autoFocus
            editable={pending === null}
            error={error}
            hint="Friends can find you by this address to share a ledger."
            inputStyle={{ fontSize: 17 }}
          />
        </Rise>
        <View style={styles.flex} />
        <View style={styles.actions}>
          <Button wide icon={undefined} iconRight={Icons.arrowR} onPress={requestCode} loading={pending === 'send'} disabled={pending === 'google'} style={{ height: 56 }}>
            Send code
          </Button>
          <View style={styles.or}>
            <View style={[styles.line, { backgroundColor: colors.line }]} />
            <Label>or</Label>
            <View style={[styles.line, { backgroundColor: colors.line }]} />
          </View>
          <Button
            wide
            variant="outline"
            icon={() => <GoogleIcon />}
            onPress={google}
            loading={pending === 'google'}
            disabled={pending === 'send'}
          >
            Continue with Google
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  intro: { paddingHorizontal: 24, paddingTop: 12 },
  field: { paddingHorizontal: 24, paddingTop: 28 },
  actions: { paddingHorizontal: 24, gap: 12, paddingTop: 24 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
})
