import { Text } from 'react-native'
import { colors } from '../constants/theme.js'
import { formatMoney } from '../utils/format.js'

// Rule MOB-08: currency code always shown beside the number. Bare numbers
// are never displayed.
export function CurrencyText({ amount, currency, style, neutral = false }) {
  const negative = Number(amount) < 0
  const textStyle = [
    style,
    neutral
      ? {}
      : { color: negative ? colors.warningRed : colors.textPrimary }
  ]
  return <Text style={textStyle}>{formatMoney(amount, currency)}</Text>
}