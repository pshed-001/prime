export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE']
export const ASSET_CATEGORIES = [
  'DEVICE',
  'VEHICLE',
  'PROPERTY',
  'BANK_ACCOUNT',
  'INVESTMENT',
  'OTHER'
]
export const SYNC_OPS = ['CREATE', 'UPDATE', 'DELETE']
export const SOURCES = ['MANUAL', 'AI', 'IMPORTED']

export const EXPENSE_CATEGORIES = [
  'Food and Dining',
  'Transport',
  'Housing',
  'Health',
  'Education',
  'Entertainment',
  'Shopping',
  'Utilities',
  'Salary',
  'Business',
  'Investment',
  'Transfer',
  'Other'
]

export const SUPPORTED_CURRENCIES = [
  'NGN',
  'USD',
  'GBP',
  'EUR',
  'GHS',
  'KES',
  'ZAR',
  'XOF',
  'CAD',
  'AUD'
]

export const MAX_AI_AMOUNT_DEFAULT = 10_000_000
export const MAX_AI_AMOUNT_NGN = MAX_AI_AMOUNT_DEFAULT
export const APP_SCHEME = 'prime'
export const AI_RATE_LIMIT_PER_HOUR = 30
export const SYNC_BATCH_SIZE = 50
export const SYNC_MAX_RETRIES = 5
export const PASSWORD_RESET_EXPIRY_MINUTES = 30
export const EMAIL_VERIFY_EXPIRY_HOURS = 24
export const EXCHANGE_RATE_STALE_HOURS = 6
export const TOMBSTONE_RETENTION_DAYS = 90

export const PUBLIC_ENDPOINTS = [
  '/health',
  '/api/version',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email'
]

export const CURRENCY_NAMES = {
  NGN: 'Nigerian Naira',
  USD: 'US Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  GHS: 'Ghanaian Cedi',
  KES: 'Kenyan Shilling',
  ZAR: 'South African Rand',
  XOF: 'West African CFA Franc',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar'
}