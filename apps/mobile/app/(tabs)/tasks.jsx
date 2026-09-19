import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { CategoryIcon } from '../../components/CategoryIcon.jsx'
import { AddTaskBottomSheet } from '../../components/AddTaskBottomSheet.jsx'
import { useTasksStore } from '../../store/tasks.js'
import { colors } from '../../constants/theme.js'

function PriorityBar({ priority }) {
  const width = { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25 }[priority] ?? 50
  const color = { CRITICAL: '#EF4444', HIGH: '#f59e0b', MEDIUM: '#7c3aed', LOW: '#9ca3af' }[priority] ?? '#9ca3af'
  return <View style={[styles.priorityBar, { width: `${width}%`, backgroundColor: color }]} />
}

export default function TasksScreen() {
  const tasks = useTasksStore((s) => s.tasks)
  const load = useTasksStore((s) => s.load)
  const remove = useTasksStore((s) => s.remove)
  const toggleComplete = useTasksStore((s) => s.toggleComplete)
  const [addSheet, setAddSheet] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const open = tasks.filter((t) => t.status !== 'COMPLETED')
  const done = tasks.filter((t) => t.status === 'COMPLETED')

  function renderItem(item) {
    return (
      <View style={styles.row}>
        <Pressable style={styles.check} onPress={() => toggleComplete(item.id, item)}>
          {item.status === 'COMPLETED' ? <Text style={styles.checkOn}>✓</Text> : <Text style={styles.checkOff} />}
        </Pressable>
        <View style={styles.middle}>
          <Text style={[styles.title, item.status === 'COMPLETED' && styles.done]}>{item.title}</Text>
          <View style={styles.priorityTrack}>
            <PriorityBar priority={item.priority} />
          </View>
          <Text style={styles.caption}>{item.due_date ?? 'no due date'}</Text>
        </View>
        <Pressable onPress={() => remove(item.id)} hitSlop={8}>
          <Text style={styles.delete}>🗑</Text>
        </Pressable>
      </View>
    )
  }

  const data = [...open, ...done]

  return (
    <View style={styles.flex}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderItem(item)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No tasks. Tap + to add one.</Text>}
      />
      <Pressable style={styles.fab} onPress={() => setAddSheet(true)}>
        <Text style={styles.fabText}>+ New Task</Text>
      </Pressable>
      <AddTaskBottomSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 96 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  checkOn: { color: colors.successGreen, fontSize: 16, fontWeight: '700' },
  checkOff: { width: 12, height: 12 },
  middle: { flex: 1 },
  title: { fontSize: 15, color: colors.textPrimary },
  done: { textDecorationLine: 'line-through', color: colors.textSecondary },
  priorityTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  priorityBar: { height: 4 },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  delete: { fontSize: 16, color: colors.textSecondary },
  empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 32, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 14 }
})