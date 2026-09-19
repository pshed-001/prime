import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Sheet, fieldStyles as f } from './Sheet.jsx'
import { EstimatedBadge } from './EstimatedBadge.jsx'
import { useAssetsStore } from '../store/assets.js'
import { useSettingsStore } from '../store/settings.js'
import { getRate } from '../lib/exchange-rates.js'
import { ASSET_CATEGORY_DICT, currencyList } from '../constants/categories.js'
import { formatMoney, toLocalDateTime } from '../utils/format.js'
import { colors } from '../constants/theme.js'

const CATEGORIES = Object.keys(ASSET_CATEGORY_DICT)

export function AddAssetBottomSheet({ visible, onClose }) {
  const add = useAssetsStore((s) => s.add)
  const base = useSettingsStore((s) => s.baseCurrency)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('CASH')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState(base)
  const [note, setNote] = useState('')
  const [acquiredAt, setAcquiredAt] = useState('')
  const [rate, setRate] = useState({ rate: 1, estimated: false })
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!visible) return
    getRate({ from: currency, to: base }).then((r) => {
      if (active) setRate(r)
    })
    return () => {
      active = false
    }
  }, [currency, base, visible])

  const numeric = Number(value.replace(/,/g, ''))
  const converted = Number.isFinite(numeric) ? numeric * rate.rate : 0

  async function submit() {
    if (!name.trim() || !numeric || numeric <= 0) {
      setError('Name and a valid value are required.')
      return
    }
    await add({
      name: name.trim(),
      category,
      value: numeric,
      currency,
      valueBase: converted,
      exchangeRate: rate.estimated ? rate.rate : null,
      rateIsEst: rate.estimated,
      note,
      acquiredAt: toLocalDateTime(acquiredAt)
    })
    setName('')
    setValue('')
    setNote('')
    setAcquiredAt('')
    setError('')
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="New Asset">
      <Text style={f.label}>Name</Text>
      <TextInput
        style={f.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. GTBank Savings"
        placeholderTextColor={'#9ca3af'}
      />

      <Text style={f.label}>Category</Text>
      <View style={f.row}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[f.chip, category === c && f.chipActive]}
          >
            <Text style={[f.chipText, category === c && f.chipTextActive]}>
              {ASSET_CATEGORY_DICT[c].label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={f.label}>Value</Text>
      <TextInput
        style={f.input}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={'#9ca3af'}
      />
      {currency !== base ? (
        <Text style={{ fontSize: 12, marginTop: 4, color: colors.textSecondary }}>
          ≈ {formatMoney(converted, base)} <EstimatedBadge visible={rate.estimated} />
        </Text>
      ) : null}

      <Text style={f.label}>Currency</Text>
      <View style={f.row}>
        {currencyList.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCurrency(c)}
            style={[f.chip, currency === c && f.chipActive]}
          >
            <Text style={[f.chipText, currency === c && f.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={f.label}>Acquired date (YYYY-MM-DD)</Text>
      <TextInput style={f.input} value={acquiredAt} onChangeText={setAcquiredAt} />

      <Text style={f.label}>Note (optional)</Text>
      <TextInput style={f.input} value={note} onChangeText={setNote} />

      {error ? <Text style={f.error}>{error}</Text> : null}
      <Pressable style={f.submit} onPress={submit}>
        <Text style={f.submitText}>Save Asset</Text>
      </Pressable>
    </Sheet>
  )
}