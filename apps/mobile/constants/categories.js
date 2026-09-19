// Expenditure categories are the record dict from the design doc (4.2).
// Budget-affected categories are: income, food_and_drinks, entertainment,
// transport, shopping, housing, other.
export const CATEGORY_DICT = {
  INCOME: { label: 'Income', emoji: '💰', budget: true },
  FOOD_AND_DRINKS: { label: 'Food & Drinks', emoji: '🍔', budget: true },
  ENTERTAINMENT: { label: 'Entertainment', emoji: '🎬', budget: true },
  TRANSPORT: { label: 'Transport', emoji: '🚗', budget: true },
  SHOPPING: { label: 'Shopping', emoji: '🛍️', budget: true },
  HOUSING: { label: 'Housing', emoji: '🏠', budget: true },
  OTHER: { label: 'Other', emoji: '📦', budget: true }
}

export const ASSET_CATEGORY_DICT = {
  CASH: { label: 'Cash', emoji: '💵' },
  BANK_ACCOUNT: { label: 'Bank Account', emoji: '🏦' },
  CRYPTO: { label: 'Crypto', emoji: '🪙' },
  VEHICLE: { label: 'Vehicle', emoji: '🚙' },
  REAL_ESTATE: { label: 'Real Estate', emoji: '🏘️' },
  INVESTMENT: { label: 'Investment', emoji: '📈' },
  RECEIVABLE: { label: 'Receivable', emoji: '🧾' },
  OTHER: { label: 'Other', emoji: '📦' }
}

export const currencyList = ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR', 'XOF', 'CAD', 'AED']