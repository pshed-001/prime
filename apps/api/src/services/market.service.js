// Live market board: crypto (CoinGecko, no key), stock indices (Yahoo
// Finance, no key, Stooq fallback) and market news headlines (Yahoo Finance
// RSS). Every source is fetched in parallel with a hard deadline and results
// are cached in memory with short TTLs so the endpoint answers in milliseconds
// on repeat hits (fastest path), mirroring the app's estimate-fallback ethos:
// a failing source degrades that section instead of failing the whole board.
import { logger } from '../lib/logger.js'

// Serving strategy: stale-while-revalidate with a hard cold budget. The
// endpoint never waits more than COLD_BUDGET_MS (first-ever hit); every later
// hit returns from the in-memory cache in ~0ms while a background refetch tops
// up the cache. This keeps a single request comfortably inside the <3s target.
const TIMEOUT_MS = 8000
const TTL = { crypto: 45_000, indices: 45_000, news: 180_000 }
const NEWS_LIMIT = 16
const COLD_BUDGET_MS = 2500

const CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'ripple', 'dogecoin']
const CRYPTO_CURRENCY = 'usd'

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^FTSE', name: 'FTSE 100' },
  { symbol: '^N225', name: 'Nikkei 225' },
  { symbol: '^GDAXI', name: 'DAX' }
]
const STOOQ_SYMBOLS = { '^GSPC': '^spx', '^DJI': '^dji', '^IXIC': '^ndq', '^FTSE': '^ukx', '^N225': '^nkx', '^GDAXI': '^dax' }

const YAHOO_CHART_URL = (symbol) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
const STOOQ_URL = (symbol) =>
  `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`

const NEWS_FEEDS = [
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EDJI,%5EIXIC,btc,eth,usd&region=US&lang=en-US', source: 'Yahoo Finance' },
  { url: 'https://news.google.com/rss/search?q=%22stock%20market%22%20OR%20crypto%20OR%20forex&hl=en-US&gl=US&ceid=US:en', source: 'Google News' }
]

const cache = {
  crypto: { data: null, at: 0 },
  indices: { data: null, at: 0 },
  news: { data: null, at: 0 }
}

function fresh(entry, ttlMs, now) {
  return entry.data && now - entry.at < ttlMs
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Serve one section: return the cached value instantly when fresh, otherwise
// refetch in the background and only write the result when it succeeds.
async function serveSection(key, fetchFn, board) {
  const now = Date.now()
  const entry = cache[key]
  if (fresh(entry, TTL[key], now)) {
    board[key] = entry.data
    return
  }
  try {
    const data = await fetchFn()
    cache[key] = { data, at: Date.now() }
    board[key] = data
  } catch (error) {
    // Never throw out of a section. Stale data (even empty) beats a 500.
    logger.warn(`[market] ${key} refresh failed`, { error: error.message })
    board[key] = entry.data ?? []
  }
}

export async function getLiveFeed() {
  const board = { crypto: [], indices: [], news: [] }
  const tasks = [
    serveSection('crypto', fetchCrypto, board),
    serveSection('indices', fetchIndices, board),
    serveSection('news', fetchNews, board)
  ]
  // All sections run in parallel; if they finish first the board is complete,
  // otherwise the cache hands back what finished within the cold budget and
  // the still-pending sections keep populating the cache for the next call.
  await Promise.race([Promise.all(tasks), wait(COLD_BUDGET_MS)])
  return { ...board, updatedAt: new Date().toISOString() }
}

// One retry per source absorbs the cold-connection / transient timeouts that
// are common with free public feeds. A retry only happens for real upstreams,
// never for the in-memory cache path.
async function fetchText(url, retries = 2) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (PRIME/1.0)' }
      })
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      return await res.text()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function snap(value, digits = 4) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Number(n.toFixed(digits))
}

function percent(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return Number(((a - b) / b) * 100)
}

function unescapeHtml(text) {
  return (text ?? '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// Tolerant RSS 2.0 + Atom item extractor (title / link / date / source) that
// avoids adding an XML dependency. Only the fields the board displays.
function parseFeed(xml) {
  const items = []
  const blocks = xml.matchAll(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g)
  for (const block of blocks) {
    const body = block[0]
    const read = (re) => body.match(re)?.[1]
    const title = unescapeHtml(read(/<title[^>]*>([\s\S]*?)<\/title>/))
    if (!title) continue
    let link = unescapeHtml(read(/<link[^>]*>\s*([^<\s][^<]*)<\/link>/))
    if (!link) link = unescapeHtml(read(/<link[^>]*href="([^"]+)"/))
    const dateStr = read(/<pubDate>([^<]+)<\/pubDate>/) ?? read(/<updated[^>]*>([^<]+)<\/updated>/)
    const date = dateStr ? new Date(dateStr.replace(/\s+$/, '')) : null
    items.push({ title, link: link || null, date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null })
  }
  return items
}

async function fetchCrypto() {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO_IDS.join(',')}&vs_currencies=${CRYPTO_CURRENCY}&include_24hr_change=true&include_last_updated_at=true`
  const body = JSON.parse(await fetchText(url))
  return CRYPTO_IDS.filter((id) => body[id]).map((id) => {
    const row = body[id]
    return {
      id,
      symbol: id,
      name: id[0].toUpperCase() + id.slice(1),
      currency: CRYPTO_CURRENCY.toUpperCase(),
      price: snap(row[CRYPTO_CURRENCY]),
      change24h: snap(row[`${CRYPTO_CURRENCY}_24h_change`], 4),
      updatedAt: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString()
    }
  })
}

async function fetchIndexYahoo(symbol) {
  const body = JSON.parse(await fetchText(YAHOO_CHART_URL(symbol)))
  const result = body?.chart?.result?.[0]
  const meta = result?.meta
  if (!meta || !Number.isFinite(meta.regularMarketPrice)) throw new Error('no price in yahoo payload')
  const price = meta.regularMarketPrice
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null
  return { price, changePercent: percent(price, previousClose), source: 'yahoo' }
}

// Stooq is a delayed CSV fallback (price-only, no reliable intraday change).
async function fetchIndexStooq(symbol) {
  const csv = await fetchText(STOOQ_URL(STOOQ_SYMBOLS[symbol]))
  const rows = csv.trim().split('\n').slice(1)
  const last = rows[rows.length - 1]?.split(',')
  const price = Number(last?.[6])
  if (!Number.isFinite(price)) throw new Error('no stooq row')
  return { price, changePercent: null, source: 'stooq.delayed' }
}

async function fetchIndices() {
  const results = await Promise.allSettled(
    INDICES.map(async (index) => {
      try {
        return { ...index, ...(await fetchIndexYahoo(index.symbol)) }
      } catch (yahooError) {
        if (!STOOQ_SYMBOLS[index.symbol]) {
          logger.warn('[market] index source failed', { symbol: index.symbol, error: yahooError.message })
          return { ...index, price: null, changePercent: null, source: 'unavailable' }
        }
        try {
          return { ...index, ...(await fetchIndexStooq(index.symbol)) }
        } catch (stooqError) {
          logger.warn('[market] index sources failed', { symbol: index.symbol, yahoo: yahooError.message, stooq: stooqError.message })
          return { ...index, price: null, changePercent: null, source: 'unavailable' }
        }
      }
    })
  )
  const fetched = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const priceIndex = new Set(fetched.map((r) => r.symbol))
  const remaining = INDICES.filter((i) => !priceIndex.has(i.symbol))
  return [...fetched, ...remaining.map((i) => ({ ...i, price: null, changePercent: null, source: 'unavailable' }))]
    .map((row) => ({ ...row, price: snap(row.price), changePercent: snap(row.changePercent, 2) }))
}

async function fetchNews() {
  const feeds = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchText(feed.url).then(parseFeed)))
  const seen = new Set()
  const items = []
  const addItems = (list, source) => {
    for (const item of list) {
      const key = item.title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ ...item, source })
    }
  }
  feeds.forEach((r, i) => {
    if (r.status === 'fulfilled') addItems(r.value, NEWS_FEEDS[i].source)
    else logger.warn('[market] news feed failed', { feed: NEWS_FEEDS[i].url, error: r.reason.message })
  })
  return items
    .sort((a, b) => (a.date ?? '') < (b.date ?? '') ? 1 : -1)
    .slice(0, NEWS_LIMIT)
    .map((item) => ({ ...item, date: item.date ?? new Date().toISOString() }))
}