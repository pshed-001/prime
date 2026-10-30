import { useMemo } from 'react'
import { Text } from 'react-native'
import { useTheme } from '../constants/theme.js'
import { formatMoney } from '../utils/format.js'

// Rule MOB-08: currency code always shown beside the number. Bare numbers
// are never displayed.
export function CurrencyText({ amount, currency, style, neutral = false }) {
  const colors = useTheme()
  const negative = Number(amount) < 0
  const textStyle = useMemo(
    () => [
      style,
      neutral ? {} : { color: negative ? colors.warningRed : colors.textPrimary }
    ],
    [style, neutral, negative, colors]
  )
  return <Text style={textStyle}>{formatMoney(amount, currency)}</Text>
}