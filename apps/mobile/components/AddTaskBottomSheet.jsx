import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Sheet, fieldStyles as f } from './Sheet.jsx'
import { useTasksStore } from '../store/tasks.js'
import { toLocalDateTime } from '../utils/format.js'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function AddTaskBottomSheet({ visible, onClose }) {
  const add = useTasksStore((s) => s.add)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    await add({ title: title.trim(), description, priority, dueDate: toLocalDateTime(dueDate) })
    setTitle('')
    setDescription('')
    setPriority('MEDIUM')
    setDueDate('')
    setError('')
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="New Task">
      <Text style={f.label}>Title</Text>
      <TextInput
        style={f.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Pay electricity bill"
        placeholderTextColor={'#9ca3af'}
      />
      <Text style={f.label}>Description (optional)</Text>
      <TextInput
        style={f.input}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={f.label}>Priority</Text>
      <View style={f.row}>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPriority(p)}
            style={[f.chip, priority === p && f.chipActive]}
          >
            <Text style={[f.chipText, priority === p && f.chipTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={f.label}>Due date (YYYY-MM-DD)</Text>
      <TextInput
        style={f.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2026-01-31"
        placeholderTextColor={'#9ca3af'}
      />
      {error ? <Text style={f.error}>{error}</Text> : null}
      <Pressable style={f.submit} onPress={submit}>
        <Text style={f.submitText}>Save Task</Text>
      </Pressable>
    </Sheet>
  )
}