import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd) throw new Error(`Missing required environment variable: ${name}`)
    console.warn(`[env] Warning: ${name} is not set (using placeholder in non-production)`)
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 65536),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 4)
  },
  qwenApiUrl:
    process.env.QWEN_API_URL ??
    'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-7B-Instruct',
  qwenApiKey: process.env.QWEN_API_KEY ?? '',
  exchangeRateApiUrl: process.env.EXCHANGE_RATE_API_URL ?? 'https://open.er-api.com/v6/latest',
  exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY ?? '',
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 100)
  },
  aiRateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 30),
  maxAiAmountNgn: Number(process.env.MAX_AI_AMOUNT_NGN ?? 10_000_000),
  emailFrom: process.env.EMAIL_FROM ?? 'noreply@prime.itgel.com',
  emailApiKey: process.env.EMAIL_API_KEY ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxyIps: (process.env.TRUST_PROXY_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  appScheme: process.env.APP_SCHEME ?? 'prime',
  privacyPolicyUrl: process.env.PRIVACY_POLICY_URL ?? 'https://itgel.com/privacy'
}