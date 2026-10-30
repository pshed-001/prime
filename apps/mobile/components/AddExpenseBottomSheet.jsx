import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Sheet, createFieldStyles } from './Sheet.jsx'
import { EstimatedBadge } from './EstimatedBadge.jsx'
import { useExpensesStore } from '../store/expenses.js'
import { useSettingsStore } from '../store/settings.js'
import { getRate } from '../lib/exchange-rates.js'
import { CATEGORY_DICT, currencyList } from '../constants/categories.js'
import { formatMoney, todayInTimezone, toLocalDateTime } from '../utils/format.js'
import { useTheme } from '../constants/theme.js'

const CATEGORIES = Object.keys(CATEGORY_DICT)

export function AddExpenseBottomSheet({ visible, onClose }) {
  const add = useExpensesStore((s) => s.add)
  const base = useSettingsStore((s) => s.baseCurrency)
  const timezone = useSettingsStore((s) => s.timezone)
  const theme = useTheme()
  const f = useMemo(() => createFieldStyles(theme), [theme])

  const [type, setType] = useState('EXPENSE')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(base)
  const [category, setCategory] = useState('FOOD_AND_DRINKS')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayInTimezone(timezone))
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

  const numeric = Number(amount.replace(/,/g, ''))
  const converted = Number.isFinite(numeric) ? numeric * rate.rate : 0

  async function submit() {
    if (!numeric || numeric <= 0) {
      setError('Enter a valid amount.')
      return
    }
    await add({
      amount: numeric,
      currency,
      amountBase: converted,
      exchangeRate: rate.estimated ? rate.rate : null,
      rateIsEst: rate.estimated,
      type,
      category: type === 'INCOME' ? 'INCOME' : category,
      note,
      date: toLocalDateTime(date, new Date().toTimeString().slice(0, 8))
    })
    setAmount('')
    setNote('')
    setRate({ rate: 1, estimated: false })
    setError('')
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add Expense">
      <View style={f.row}>
        {['EXPENSE', 'INCOME'].map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={[f.chip, type === t && f.chipActive]}>
            <Text style={[f.chipText, type === t && f.chipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={f.label}>Amount</Text>
      <TextInput
        style={f.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={'#9ca3af'}
      />
      {currency !== base ? (
        <Text style={{ fontSize: 12, marginTop: 4, color: theme.textSecondary }}>
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

      {type === 'EXPENSE' ? (
        <>
          <Text style={f.label}>Category</Text>
          <View style={f.row}>
            {CATEGORIES.filter((c) => c !== 'INCOME').map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[f.chip, category === c && f.chipActive]}
              >
                <Text style={[f.chipText, category === c && f.chipTextActive]}>
                  {CATEGORY_DICT[c].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={f.label}>Date (YYYY-MM-DD)</Text>
      <TextInput style={f.input} value={date} onChangeText={setDate} />

      <Text style={f.label}>Note (optional)</Text>
      <TextInput style={f.input} value={note} onChangeText={setNote} />

      {error ? <Text style={f.error}>{error}</Text> : null}
      <Pressable style={f.submit} onPress={submit}>
        <Text style={f.submitText}>Save</Text>
      </Pressable>
    </Sheet>
  )
}