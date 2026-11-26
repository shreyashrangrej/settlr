import { api } from '@settlr/backend/convex/_generated/api'
import { CURRENCIES, profileName } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Chip, Field, Segmented, Switch } from '@/components/controls'
import { Icons, type IconComponent } from '@/components/icons'
import { confirm, Sheet, SheetTitle, toast } from '@/components/overlay'
import { Screen, TopBar } from '@/components/screen'
import { Card, Rise, Row, Rows } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Tile } from '@/components/tiles'
import { errorText, useRun } from '@/lib/actions'
import { errorMessage, signOut, SITE_URL, updateName } from '@/lib/auth-client'
import { currencySymbol } from '@/lib/format'
import { useMe } from '@/lib/me'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { useColors, type Hue } from '@/theme'

const DOCS_URL = 'https://settlr-docs.vercel.app/docs'

type Editing = 'name' | 'currency' | 'upi' | null

export default function ProfileScreen() {
  const colors = useColors()
  const router = useRouter()
  const me = useMe()
  const prefs = usePrefs()
  const profile = useQuery(api.profiles.me)
  const update = useMutation(api.profiles.update)
  const { run } = useRun()
  const [editing, setEditing] = useState<Editing>(null)
  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    const ok = await confirm({ title: 'Sign out?', body: 'You can sign back in with a code sent to your email.', confirm: 'Sign out', icon: Icons.logout })
    if (!ok) return
    setSigningOut(true)
    try {
      // The session clears and the root layout goes back to Welcome.
      await signOut()
    } catch (err) {
      toast(errorMessage(err), { tone: 'bad' })
      setSigningOut(false)
    }
  }

  const connector = `${SITE_URL}/api/mcp`
  return (
    <Screen>
      <TopBar />
      <Rise index={1} style={styles.head}>
        <Avatar name={me.name || me.email} me size="lg" />
        <View style={styles.grow}>
          <Text accessibilityRole="header" display weight={700} size={26} lineHeight={32} numberOfLines={2}>
            {me.name || 'No name yet'}
          </Text>
          <Sub numberOfLines={1}>{me.email}</Sub>
        </View>
        <IconButton icon={Icons.pen} tone="neutral" label="Edit name" onPress={() => setEditing('name')} />
      </Rise>

      <Label style={styles.label}>Preferences</Label>
      <Rise index={2}>
        <Card style={styles.gutter}>
          <Rows>
            <Setting
              icon={Icons.globe}
              hue="green"
              title="Default currency"
              sub="For new friends, groups and personal expenses"
              onPress={() => setEditing('currency')}
              end={
                <View style={styles.row}>
                  <Text weight={800} size={15}>
                    {currencySymbol(prefs.currency)} {prefs.currency}
                  </Text>
                  <Icons.chevR color={colors.faint} size={18} />
                </View>
              }
            />
            <View style={{ paddingBottom: 12 }}>
              <Setting icon={Icons.palette} hue="violet" title="Appearance" sub="Follows your phone until you pick one" />
              <Segmented
                style={{ marginLeft: 70, marginRight: 16 }}
                height={42}
                value={prefs.theme}
                onChange={(theme) => setPrefs({ theme })}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light', icon: Icons.sun },
                  { value: 'dark', label: 'Dark', icon: Icons.moon },
                ]}
                label="Appearance"
              />
            </View>
            <Setting
              icon={Icons.spark}
              hue="blue"
              title="Reduce motion"
              sub="Always on when Android's Remove animations is"
              end={<Switch label="Reduce motion" value={prefs.reduceMotion} onChange={(reduceMotion) => setPrefs({ reduceMotion })} />}
            />
            <Setting
              icon={Icons.vibrate}
              hue="amber"
              title="Haptics"
              sub="Ticks on keys, a thud when you settle"
              end={<Switch label="Haptics" value={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />}
            />
          </Rows>
        </Card>
      </Rise>

      <Label style={styles.label}>Account · on every device</Label>
      <Rise index={3}>
        <Card style={styles.gutter}>
          <Rows>
            <Setting
              icon={Icons.qr}
              hue="orange"
              title="Your UPI id"
              sub={profile?.upiId ? `${profile.upiId} · people who owe you in INR get Pay with UPI` : 'Add it so people who owe you can pay with UPI'}
              onPress={() => setEditing('upi')}
              end={<Icons.pen color={colors.faint} size={18} />}
            />
            <Setting
              icon={Icons.mail}
              hue="blue"
              title="Weekly digest"
              sub="An email on Mondays: what you spent, where balances stand"
              end={
                <Switch
                  label="Weekly digest"
                  value={profile?.weeklyDigest ?? false}
                  onChange={(weeklyDigest) =>
                    run(() => update({ upiId: profile?.upiId ?? null, weeklyDigest }), weeklyDigest ? 'Digest on' : 'Digest off')
                  }
                />
              }
            />
            <Setting icon={Icons.piggy} hue="green" title="Budget" sub="Your monthly spending budget" onPress={() => router.push('/budget')} end={<Icons.chevR color={colors.faint} size={18} />} />
          </Rows>
        </Card>
      </Rise>

      <Label style={styles.label}>AI apps</Label>
      <Rise index={3}>
        <Card style={styles.gutter}>
          <Row
            style={{ alignItems: 'flex-start' }}
            leading={<Tile hue="teal" size={40} radius={13} icon={Icons.layers} iconSize={18} />}
            title="Use Settlr from Claude or ChatGPT"
            titleSize={15}
            subtitle={
              <View>
                <Sub>Add the Settlr connector URL in your AI app and sign in. It can add, find and edit expenses as you.</Sub>
                <Chip
                  tone="accent"
                  icon={Icons.copy}
                  height={34}
                  style={{ marginTop: 10, alignSelf: 'flex-start' }}
                  onPress={async () => {
                    await Clipboard.setStringAsync(connector)
                    toast('Connector URL copied')
                  }}
                >
                  Copy connector URL
                </Chip>
              </View>
            }
          />
        </Card>
      </Rise>

      <Rise index={4}>
        <Card style={[styles.gutter, { marginTop: 16 }]}>
          <Rows>
            <Setting icon={Icons.help} title="Help & docs" onPress={() => WebBrowser.openBrowserAsync(DOCS_URL)} end={<Icons.out color={colors.faint} size={18} />} />
            <Setting
              icon={Icons.logout}
              danger
              title={signingOut ? 'Signing out…' : 'Sign out'}
              onPress={signingOut ? undefined : onSignOut}
            />
          </Rows>
        </Card>
      </Rise>
      <Sub align="center" size={12} style={{ marginTop: 18 }}>
        Settlr for Android · {Constants.expoConfig?.version ?? '1.0'}
      </Sub>

      <NameSheet open={editing === 'name'} onClose={() => setEditing(null)} current={me.name} />
      <UpiSheet
        open={editing === 'upi'}
        onClose={() => setEditing(null)}
        current={profile?.upiId ?? ''}
        onSave={async (upiId) => {
          const done = await run(() => update({ upiId, weeklyDigest: profile?.weeklyDigest ?? false }), upiId ? 'UPI id saved' : 'UPI id removed')
          if (done !== undefined) setEditing(null)
        }}
      />
      <Sheet open={editing === 'currency'} onClose={() => setEditing(null)} label="Default currency">
        <SheetTitle>Default currency</SheetTitle>
        <View style={{ paddingVertical: 8 }}>
          {CURRENCIES.map((c) => (
            <Row
              key={c}
              minHeight={56}
              leading={<Tile size={40} radius={13} letter={currencySymbol(c)} />}
              title={c}
              end={c === prefs.currency ? <Icons.check color={colors.accent} size={20} /> : null}
              onPress={() => {
                setPrefs({ currency: c })
                setEditing(null)
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  )
}

function Setting({
  icon,
  hue,
  title,
  sub,
  end,
  onPress,
  danger,
}: {
  icon: IconComponent
  hue?: Hue
  title: string
  sub?: string
  end?: ReactNode
  onPress?: () => void
  danger?: boolean
}) {
  const colors = useColors()
  return (
    <Row
      minHeight={hue ? 68 : 58}
      leading={
        <Tile
          size={40}
          radius={13}
          hue={hue}
          bg={danger ? colors.oweSoft : hue ? undefined : colors.surface2}
          fg={danger ? colors.owe : hue ? undefined : colors.muted}
          icon={icon}
          iconSize={18}
        />
      }
      title={title}
      titleSize={15}
      titleColor={danger ? colors.owe : undefined}
      subtitle={sub}
      wrap
      end={end}
      onPress={onPress}
    />
  )
}

function NameSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open) {
      setName(current)
      setError(null)
    }
  }, [current, open])
  async function save() {
    const parsed = profileName.safeParse({ name })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter your name')
    setPending(true)
    try {
      await updateName(parsed.data.name)
      toast('Name saved')
      onClose()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="Your name">
      <SheetTitle>Your name</SheetTitle>
      <View style={styles.sheetBody}>
        <Field label="Full name" value={name} onChangeText={setName} autoFocus autoCapitalize="words" error={error} onSubmitEditing={save} hint="Friends and groups see this name." />
        <Button wide onPress={save} loading={pending}>
          Save
        </Button>
      </View>
    </Sheet>
  )
}

function UpiSheet({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: string; onSave: (upiId: string | null) => void }) {
  const [upi, setUpi] = useState(current)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setUpi(current)
      setError(null)
    }
  }, [current, open])
  return (
    <Sheet open={open} onClose={onClose} label="Your UPI id">
      <SheetTitle>Your UPI id</SheetTitle>
      <View style={styles.sheetBody}>
        <Field
          label="UPI id"
          value={upi}
          onChangeText={(t) => {
            setUpi(t)
            setError(null)
          }}
          placeholder="name@bank"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          error={error}
          hint="Only people who owe you in INR see it, on Pay with UPI."
        />
        <Button
          wide
          onPress={() => {
            const value = upi.trim()
            if (value && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/.test(value)) return setError('That doesn’t look like a UPI id (name@bank).')
            onSave(value || null)
          }}
        >
          Save
        </Button>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gutter: { marginHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  label: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
})
