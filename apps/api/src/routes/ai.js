import { Router } from 'express'
import multer from 'multer'
import { aiConfirmSchema, MAX_AI_AMOUNT_NGN } from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'
import * as aiService from '../services/ai.service.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(null, true)
    return cb(
      new AppError(ErrorCodes.INVALID_IMAGE_FORMAT, ErrorMessage[ErrorCodes.INVALID_IMAGE_FORMAT], {
        status: 400
      })
    )
  }
})

router.post(
  '/scan',
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      throw new AppError(ErrorCodes.INVALID_IMAGE_FORMAT, ErrorMessage[ErrorCodes.INVALID_IMAGE_FORMAT], {
        status: 400
      })
    }
    const result = await aiService.createScanJob({
      userId: req.user.id,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size
    })
    return ok(res, result, 202)
  }
)

router.get('/scan/:jobId/stream', async (req, res) => {
  const { jobId } = req.params
  const job = aiService.getJobForUser(jobId, req.user.id)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, private',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const onEdge = () => res.end()

  try {
    const result = await aiService.runQwenScan({
      jobId,
      userId: req.user.id,
      buffer: job.buffer,
      mimetype: job.mimetype,
      onToken: (chunk) => {
        sendEvent('token', { chunk })
        if (res.flushHeaders) res.flushHeaders()
      }
    })

    const flagged = (result.entries ?? []).filter((e) => e.amount != null && e.amount > MAX_AI_AMOUNT_NGN)
    sendEvent('complete', { result, highValue: flagged.length > 0 ? flagged : undefined })
  } catch (error) {
    const code = error instanceof AppError ? error.code : ErrorCodes.AI_PARSE_FAILED
    const message = error instanceof AppError ? error.message : ErrorMessage[ErrorCodes.AI_PARSE_FAILED]
    sendEvent('error', { code, message })
  } finally {
    onEdge()
  }
})

router.post('/confirm/:jobId', async (req, res) => {
  const { jobId } = req.params
  const { entries } = parse(aiConfirmSchema, req.body)
  const result = await aiService.confirmEntries({ userId: req.user.id, jobId, entries })
  return ok(res, result, 201)
})

router.delete('/cancel/:jobId', async (req, res) => {
  const { jobId } = req.params
  const result = await aiService.cancelJob({ userId: req.user.id, jobId })
  return ok(res, result)
})

export default router