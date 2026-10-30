// Midnight daily report generation (design doc 6.1.1). Runs once per day for
// the previous calendar day. The report is generated locally with
// expo-print and written to the reports table; a notification with the PDF
// path is fired when ready. Generation is idempotent per (user, date).
//
// Triggered three ways:
//   1. Background task (best effort, OS may delay).
//   2. On every app foreground (AppState 'active') - MOB-04.
//   3. Manual "Generate" button on the Reports screen.
import * as Print from 'expo-print'
// import * as Notifications from 'expo-notifications'
import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import { getDb } from './database.js'
import { uuidv7 } from '../utils/uuid.js'
import { previousDayInTimezone } from '../utils/format.js'
import { useSettingsStore } from '../store/settings.js'

const REPORT_TASK = 'prime-daily-report'

async function computeReport(db, reportDate) {
  // Stored expense dates are RFC3339 strings carrying the device's local
  // offset, so substr() isolates the CALENDAR day the user sees - correct
  // day-splitting regardless of device vs server timezone (6.1.1).
  const rows = await db.getAllAsync(
    `SELECT type, amount_base FROM expenses
     WHERE deleted_at IS NULL AND substr(date, 1, 10) = ?`,
    reportDate
  )
  let totalIncome = 0
  let totalExpense = 0
  for (const r of rows) {
    if (r.type === 'INCOME') totalIncome += r.amount_base
    else totalExpense += r.amount_base
  }
  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense
  }
}

async function renderPdf(report, date) {
  const html = `
    <html>
      <head><style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; }
        h1 { font-size: 20px; color: #059669; }
        .row { display: flex; justify-content: space-between; margin: 6px 0; }
        .label { color: #6b7280; }
        .total { border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px; font-weight: 700; }
      </style></head>
      <body>
        <h1>PRIME Daily Report - ${date}</h1>
        <div class="row"><span class="label">Income</span><span>${report.totalIncome}</span></div>
        <div class="row"><span class="label">Expense</span><span>${report.totalExpense}</span></div>
        <div class="row total"><span class="label">Net balance</span><span>${report.netBalance}</span></div>
        <p style="color:#6b7280;font-size:12px">All figures in ${report.baseCurrency}.</p>
      </body>
    </html>`
  const { uri } = await Print.printToFileAsync({ html })
  return uri
}

export async function generatePreviousDayReport(checkDate = new Date()) {
  const settings = useSettingsStore.getState()
  const reportDate = previousDayInTimezone(settings.timezone, checkDate)

  const db = await getDb()
  const existing = await db.getFirstAsync(
    'SELECT id FROM reports WHERE user_id = ? AND date = ?',
    'local-user',
    reportDate
  )
  if (existing) return null // already generated - idempotent

  const summary = await computeReport(db, reportDate)
  const pdfPath = await renderPdf({ ...summary, baseCurrency: settings.baseCurrency }, reportDate)

  const id = uuidv7()
  await db.runAsync(
    `INSERT INTO reports (id, user_id, date, base_currency, total_income, total_expense, net_balance, pdf_path)
     VALUES (?, 'local-user', ?, ?, ?, ?, ?, ?)`,
    id,
    reportDate,
    settings.baseCurrency,
    summary.totalIncome,
    summary.totalExpense,
    summary.netBalance,
    pdfPath
  )

  // await Notifications.scheduleNotificationAsync({
  //   content: {
  //     title: 'PRIME Report ready',
  //     body: `${reportDate} report generated. Open Reports to view the PDF.`,
  //     data: { reportId: id, path: pdfPath }
  //   },
  //   trigger: null
  // })
  return id
}

// Background fallback - the OS schedules this near-daily; foreground runs
// (below) are the reliable trigger.
TaskManager.defineTask(REPORT_TASK, async () => {
  try {
    await generatePreviousDayReport()
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.NoData
  }
})

let midnightRegistered = false

export async function registerMidnightTask() {
  if (midnightRegistered) return
  midnightRegistered = true
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(REPORT_TASK)
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(REPORT_TASK, { minimumInterval: 60 * 24 })
    }
  } catch {
    // Foreground trigger below still covers report generation.
  }
}