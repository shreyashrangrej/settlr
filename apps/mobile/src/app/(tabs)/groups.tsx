import { api } from '@settlr/backend/convex/_generated/api'
import { plural } from '@settlr/shared/format'
import { useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { IconButton } from '@/components/button'
import { Chip, ChipRow } from '@/components/controls'
import { Icons } from '@/components/icons'
import { Screen, TabHeader } from '@/components/screen'
import { Card, Empty, Rise, SkeletonRows } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Badge, GroupTile } from '@/components/tiles'
import type { GroupSummary } from '@/lib/balances'
import { money } from '@/lib/format'
import { useColors } from '@/theme'

type Filter = 'all' | 'owed' | 'owe'

export default function GroupsScreen() {
  const colors = useColors()
  const router = useRouter()
  const groups = useQuery(api.groups.list)
  const [filter, setFilter] = useState<Filter>('all')

  const active = (groups ?? []).filter((g) => !g.archived)
  const archived = (groups ?? []).filter((g) => g.archived)
  const shown = active.filter((g) =>
    filter === 'owed' ? g.myNetCents > 0 : filter === 'owe' ? g.myNetCents < 0 : true,
  )

  return (
    <Screen tab>
      <TabHeader
        title="Groups"
        actions={<IconButton icon={Icons.plus} tone="filled" label="New group" onPress={() => router.push('/groups/new')} />}
      />
      {active.length > 0 ? (
        <Rise index={1} style={{ marginTop: 6 }}>
          <ChipRow>
            <Chip tone={filter === 'all' ? 'on' : 'neutral'} selected={filter === 'all'} onPress={() => setFilter('all')}>
              {`All · ${active.length}`}
            </Chip>
            <Chip tone={filter === 'owed' ? 'on' : 'neutral'} selected={filter === 'owed'} onPress={() => setFilter('owed')}>
              Owed to you
            </Chip>
            <Chip tone={filter === 'owe' ? 'on' : 'neutral'} selected={filter === 'owe'} onPress={() => setFilter('owe')}>
              You owe
            </Chip>
          </ChipRow>
        </Rise>
      ) : null}

      <View style={styles.list}>
        {groups === undefined ? (
          <SkeletonRows count={3} />
        ) : active.length === 0 && archived.length === 0 ? (
          <Card>
            <Empty
              icon={Icons.users}
              title="No groups yet"
              hint="For a trip, a flat or a dinner. Up to 20 people, no accounts needed."
              action="Create a group"
              onAction={() => router.push('/groups/new')}
            />
          </Card>
        ) : (
          <>
            {shown.map((group, i) => (
              <Rise key={group.id} index={2 + i}>
                <GroupCard group={group} />
              </Rise>
            ))}
            {shown.length === 0 && active.length > 0 ? (
              <Sub align="center" style={{ paddingVertical: 16 }}>
                {filter === 'owed' ? 'Nobody owes you in any group.' : 'You don’t owe anything in any group.'}
              </Sub>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/groups/new')}
              style={({ pressed }) => [styles.create, { borderColor: colors.surface3, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icons.plus color={colors.muted} size={18} />
              <Text weight={800} size={15} color="muted">
                Create a group
              </Text>
            </Pressable>
            {archived.length > 0 ? (
              <>
                <View style={styles.archivedHead}>
                  <Icons.archive color={colors.faint} size={15} />
                  <Label>Archived</Label>
                </View>
                {archived.map((group) => (
                  <Pressable
                    key={group.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/groups/${group.id}`)}
                    style={({ pressed }) => [styles.archived, { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GroupTile id={group.id} name={group.name} size={40} radius={14} />
                    <View style={styles.grow}>
                      <Text weight={700} size={15} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Sub numberOfLines={1}>
                        {money(group.totalCents, group.currency)} spent · {plural(group.expenseCount, 'expense')} · {group.currency}
                      </Sub>
                    </View>
                    <Badge icon={group.myNetCents === 0 ? Icons.check : undefined} bg={colors.surface} fg={colors.muted}>
                      {group.myNetCents === 0 ? 'Settled' : money(group.myNetCents, group.currency)}
                    </Badge>
                  </Pressable>
                ))}
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  )
}

function GroupCard({ group }: { group: GroupSummary }) {
  const colors = useColors()
  const router = useRouter()
  const net = group.myNetCents
  return (
    <Card onPress={() => router.push(`/groups/${group.id}`)} accessibilityLabel={group.name} style={styles.card}>
      <View style={styles.cardHead}>
        <GroupTile id={group.id} name={group.name} size={52} radius={18} />
        <View style={styles.grow}>
          <Text weight={700} size={17} lineHeight={22} numberOfLines={1}>
            {group.name}
          </Text>
          <Sub numberOfLines={1}>
            {money(group.totalCents, group.currency)} spent · {plural(group.expenseCount, 'expense')}
          </Sub>
        </View>
        <Icons.chevR color={colors.faint} size={18} />
      </View>
      <View style={styles.cardFoot}>
        <Sub weight={600}>
          {plural(group.memberCount, 'person', 'people')} · {group.currency}
        </Sub>
        {net === 0 ? (
          <Badge size="lg" icon={Icons.check}>
            all square
          </Badge>
        ) : (
          <Badge size="lg" tone={net > 0 ? 'owed' : 'owe'} icon={net > 0 ? Icons.in : Icons.out}>
            {net > 0 ? `you’re owed ${money(net, group.currency)}` : `you owe ${money(net, group.currency)}`}
          </Badge>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  card: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardFoot: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  create: {
    height: 64,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  archivedHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 4 },
  archived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
})
