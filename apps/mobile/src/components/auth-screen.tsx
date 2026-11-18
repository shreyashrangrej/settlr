import type { ReactNode } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/text'
import { useColors } from '@/theme'

/**
 * The signed-out screens' frame from sign-in.html: `top` (the brand or a
 * back button) at the top, the form at the bottom, lifted above the keyboard.
 */
export function AuthScreen({ top, children }: { top: ReactNode; children: ReactNode }) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View>{top}</View>
        <View style={styles.form}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

export function AuthTitle({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <View style={styles.titles}>
      <Text size={30} weight={600} style={styles.title}>
        {title}
      </Text>
      <Text size={14} color="muted">
        {subtitle}
      </Text>
    </View>
  )
}

/** An error under a field or form, in the orange "owe" colour with a word to carry it. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <Text size={14} color="owe" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 40,
  },
  form: { gap: 14 },
  titles: { gap: 8, marginBottom: 14 },
  title: { letterSpacing: -0.6, lineHeight: 36 },
})
