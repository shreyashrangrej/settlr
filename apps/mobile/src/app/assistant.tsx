import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useRouter, type Href } from 'expo-router'
import { useRef, useState, type ComponentRef } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, IconButton } from '@/components/button'
import { Chip } from '@/components/controls'
import { Icons } from '@/components/icons'
import { ripple } from '@/components/ripple'
import { openExpense } from '@/components/ledger'
import { toast } from '@/components/overlay'
import { Empty } from '@/components/surfaces'
import { Sub, Text } from '@/components/text'
import { CategoryTile, Tile } from '@/components/tiles'
import { errorText } from '@/lib/actions'
import { localIsoDate, money, shortDate } from '@/lib/format'
import { usePrefs } from '@/lib/prefs'
import { cardShadow, fonts, useColors, useIsDark } from '@/theme'

type Reply = FunctionReturnType<typeof api.assistant.send>
type ChatEvent = Reply['events'][number]
type ExpenseView = Extract<ChatEvent, { type: 'added' }>['expense']
type Message =
  | { id: number; role: 'user'; content: string }
  | { id: number; role: 'assistant'; content: string; events: Array<ChatEvent>; memo: string }

const SUGGESTIONS = ['Chai 40, personal', 'How much did I spend on food this month?', 'Who owes me the most?']

/** The assistant: type what you spent (or ask), and it adds, finds and edits. */
export default function AssistantScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const prefs = usePrefs()
  const status = useQuery(api.assistant.status)
  const send = useAction(api.assistant.send)
  const [messages, setMessages] = useState<Array<Message>>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const nextId = useRef(1)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)

  async function submit(text = draft) {
    const content = text.trim()
    if (!content || thinking) return
    const user: Message = { id: nextId.current++, role: 'user', content }
    const history = [...messages, user]
    setMessages(history)
    setDraft('')
    setThinking(true)
    try {
      const reply = await send({
        messages: history.map((m) =>
          m.role === 'user' ? { role: 'user' as const, content: m.content } : { role: 'assistant' as const, content: m.content, memo: m.memo || undefined },
        ),
        today: localIsoDate(),
        currency: prefs.currency,
      })
      setMessages((all) => [...all, { id: nextId.current++, role: 'assistant', content: reply.reply, events: reply.events, memo: reply.memo }])
    } catch (err) {
      setMessages((all) => [...all, { id: nextId.current++, role: 'assistant', content: errorText(err), events: [], memo: '' }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <IconButton icon={Icons.back} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Tile size={38} radius={13} bg={colors.accent} fg={colors.onAccent} icon={Icons.spark} iconSize={18} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" weight={800} size={17} lineHeight={22}>
            Assistant
          </Text>
          <Sub size={12.5} lineHeight={16}>
            Adds, finds and edits your expenses
          </Sub>
        </View>
        {messages.length > 0 ? <IconButton icon={Icons.pen} label="New chat" onPress={() => setMessages([])} /> : null}
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {status && !status.configured ? (
          <Empty icon={Icons.spark} title="The assistant isn’t set up" hint="This Settlr server has no AI model configured yet." />
        ) : messages.length === 0 ? (
          <View style={styles.intro}>
            <Tile size={56} radius={20} bg={colors.accentSoft} fg={colors.accentInk} icon={Icons.spark} iconSize={26} />
            <Text display weight={700} size={24} lineHeight={30} align="center" style={{ marginTop: 12 }}>
              Say what you spent
            </Text>
            <Sub align="center" size={14} lineHeight={20} style={{ marginTop: 6 }}>
              “Taxi 600 in Goa trip, paid by Priya”, “Rohan paid me 500”, or ask how much went on food. It works with your groups,
              friends and personal spending.
            </Sub>
          </View>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={[styles.mine, { backgroundColor: colors.accent }]}>
                <Text weight={600} size={15} color={colors.onAccent}>
                  {m.content}
                </Text>
              </View>
            ) : (
              <View key={m.id} style={styles.theirs}>
                {m.content ? (
                  <Text weight={500} size={15} lineHeight={22}>
                    {m.content}
                  </Text>
                ) : null}
                {m.events.map((event, i) => (
                  <EventCard key={i} event={event} />
                ))}
              </View>
            ),
          )
        )}
        {thinking ? (
          <View style={[styles.typing, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
            <Sub weight={700}>Working on it…</Sub>
          </View>
        ) : null}
      </ScrollView>

      {messages.length === 0 && status?.configured ? (
        <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} tone="line" onPress={() => submit(s)}>
              {s}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.composer, { paddingBottom: insets.bottom + 14 }]}>
        <View style={[styles.field, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
          <TextInput
            accessibilityLabel="Message"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit()}
            placeholder="Add, find or change…"
            placeholderTextColor={colors.faint}
            selectionColor={colors.accent}
            editable={status?.configured !== false}
            multiline
            maxLength={1000}
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        <IconButton
          icon={Icons.send}
          label="Send"
          size={54}
          iconSize={20}
          bg={colors.accent}
          color={colors.onAccent}
          onPress={() => submit()}
          disabled={!draft.trim() || thinking || status?.configured === false}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

function parentOf(href: string) {
  return /^\/(?:groups|friends)\/([^/?#]+)/.exec(href)?.[1] ?? null
}

function ExpenseLine({ expense }: { expense: ExpenseView }) {
  const today = localIsoDate()
  return (
    <View style={styles.expense}>
      <CategoryTile category={expense.category} size={38} />
      <View style={styles.flex}>
        <Text weight={700} size={15} numberOfLines={1}>
          {expense.description}
        </Text>
        <Sub numberOfLines={1}>{[expense.with ?? 'Personal', shortDate(expense.date, today), expense.detail].filter(Boolean).join(' · ')}</Sub>
      </View>
      <Text weight={800} size={15.5} tabular>
        {money(expense.amountCents, expense.currency)}
      </Text>
    </View>
  )
}

function EventCard({ event }: { event: ChatEvent }) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const removePersonal = useMutation(api.personal.remove)
  const removeFriend = useMutation(api.friends.removeEntry)
  const removeGroup = useMutation(api.groups.removeExpense)
  const [deleted, setDeleted] = useState<'yes' | 'kept' | null>(null)
  const card = [styles.card, { backgroundColor: colors.surface }, cardShadow(isDark)]

  const open = (e: ExpenseView) => openExpense(router, { source: e.kind, id: e.id, parentId: parentOf(e.href), date: e.date })
  const footer = (text: string, onOpen?: () => void) => (
    <View style={[styles.footer, { backgroundColor: colors.owedSoft }]}>
      <Icons.check color={colors.owed} size={15} />
      <Text weight={700} size={13} color={colors.owed} style={styles.flex}>
        {text}
      </Text>
      {onOpen ? (
        <Pressable accessibilityRole="link" onPress={onOpen} hitSlop={8}>
          <Text weight={800} size={13}>
            Open
          </Text>
        </Pressable>
      ) : null}
    </View>
  )

  switch (event.type) {
    case 'added':
      return (
        <View style={card}>
          <ExpenseLine expense={event.expense} />
          {footer(`Added · your share ${money(event.expense.myShareCents, event.expense.currency)}`, () => open(event.expense))}
        </View>
      )
    case 'updated':
      return (
        <View style={card}>
          <ExpenseLine expense={event.expense} />
          {event.before.amountCents !== event.expense.amountCents ? (
            <View style={styles.change}>
              <Text weight={600} size={12} color="faint" style={{ width: 62 }}>
                Amount
              </Text>
              <Text weight={600} size={14} color="faint" style={{ textDecorationLine: 'line-through' }}>
                {money(event.before.amountCents, event.before.currency)}
              </Text>
              <Icons.arrowR color={colors.faint} size={14} />
              <Text weight={800} size={14}>
                {money(event.expense.amountCents, event.expense.currency)}
              </Text>
            </View>
          ) : null}
          {footer(`Applied · your share ${money(event.expense.myShareCents, event.expense.currency)}`, () => open(event.expense))}
        </View>
      )
    case 'found':
      return (
        <View style={card}>
          {event.expenses.slice(0, 5).map((e) => (
            <Pressable key={e.ref} onPress={() => open(e)} android_ripple={ripple(colors.text, { strength: 0.1 })}>
              <ExpenseLine expense={e} />
            </Pressable>
          ))}
          <View style={[styles.footer, { backgroundColor: colors.surface2 }]}>
            <Text weight={700} size={13} color="muted" style={styles.flex}>
              {event.count === 1 ? '1 expense' : `${event.count} expenses`}
              {event.totals.length ? ` · your share ${event.totals.map((t) => money(t.myShareCents, t.currency)).join(' + ')}` : ''}
            </Text>
          </View>
        </View>
      )
    case 'delete':
      return (
        <View style={[card, { borderWidth: 1.5, borderColor: colors.oweSoft, padding: 0 }]}>
          <ExpenseLine expense={event.expense} />
          {deleted ? (
            <Sub style={{ paddingHorizontal: 14, paddingBottom: 12 }}>{deleted === 'yes' ? 'Deleted. It’s in Trash for 30 days.' : 'Kept it.'}</Sub>
          ) : (
            <View style={styles.choices}>
              <Button
                size="sm"
                variant="danger"
                icon={Icons.trash}
                style={styles.flex}
                onPress={async () => {
                  try {
                    const e = event.expense
                    if (e.kind === 'personal') await removePersonal({ expenseId: e.id as Id<'personalExpenses'> })
                    else if (e.kind === 'friend') await removeFriend({ entryId: e.id as Id<'friendEntries'> })
                    else await removeGroup({ expenseId: e.id as Id<'groupExpenses'> })
                    setDeleted('yes')
                  } catch (err) {
                    toast(errorText(err), { tone: 'bad' })
                  }
                }}
              >
                Delete
              </Button>
              <Button size="sm" variant="neutral" style={styles.flex} onPress={() => setDeleted('kept')}>
                Keep it
              </Button>
            </View>
          )}
        </View>
      )
    case 'created':
      return (
        <View style={card}>
          <View style={styles.expense}>
            <Tile hue={event.kind === 'group' ? 'violet' : 'blue'} size={38} radius={13} icon={event.kind === 'group' ? Icons.users : Icons.userPlus} iconSize={18} />
            <View style={styles.flex}>
              <Text weight={700} size={15}>
                {event.name}
              </Text>
              <Sub>{event.detail}</Sub>
            </View>
          </View>
          {footer(event.kind === 'group' ? 'Group created' : 'Friend added', () => router.push(event.href as Href))}
        </View>
      )
    case 'payment':
      return (
        <View style={card}>
          <View style={styles.expense}>
            <Tile bg={colors.owedSoft} fg={colors.owed} size={38} radius={13} icon={Icons.swap} iconSize={18} />
            <View style={styles.flex}>
              <Text weight={700} size={15}>
                {event.from} paid {event.to === 'You' ? 'you' : event.to}
              </Text>
              <Sub>{event.where}</Sub>
            </View>
            <Text weight={800} size={15.5} tabular>
              {money(event.amountCents, event.currency)}
            </Text>
          </View>
          {footer(event.balance, () => router.push(event.href as Href))}
        </View>
      )
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 60, paddingHorizontal: 8 },
  thread: { padding: 16, paddingTop: 8, gap: 12, flexGrow: 1 },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  mine: { alignSelf: 'flex-end', maxWidth: '82%', paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6 },
  theirs: { maxWidth: '94%', gap: 8 },
  typing: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  card: { borderRadius: 20, overflow: 'hidden' },
  expense: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  choices: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  suggestions: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12 },
  field: { flex: 1, minHeight: 54, borderRadius: 27, justifyContent: 'center', paddingHorizontal: 18 },
  input: { fontFamily: fonts.sans[600], fontSize: 15.5, maxHeight: 120, paddingVertical: 14 },
})
