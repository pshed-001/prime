import { Router } from 'express'
import authRoutes from './auth.js'
import taskRoutes from './tasks.js'
import expenseRoutes from './expenses.js'
import assetRoutes from './assets.js'
import reportRoutes from './reports.js'
import syncRoutes from './sync.js'
import aiRoutes from './ai.js'
import exchangeRateRoutes from './exchange-rates.js'
import marketRoutes from './market.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/tasks', taskRoutes)
router.use('/expenses', expenseRoutes)
router.use('/assets', assetRoutes)
router.use('/reports', reportRoutes)
router.use('/sync', syncRoutes)
router.use('/ai', aiRoutes)
router.use('/exchange-rates', exchangeRateRoutes)
router.use('/market', marketRoutes)

export default router