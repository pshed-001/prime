import { Router } from 'express'
import { createAssetSchema, updateAssetSchema } from '@prime/shared'
import { parse } from '../lib/validate.js'
import { ok } from '../lib/response.js'
import * as assetService from '../services/asset.service.js'

const router = Router()

router.get('/', async (req, res) => {
  const result = await assetService.listAssets({ userId: req.user.id })
  return ok(res, result)
})

router.post('/', async (req, res) => {
  const data = parse(createAssetSchema, req.body)
  const result = await assetService.createAsset({ userId: req.user.id, data })
  return ok(res, result, 201)
})

router.get('/net-worth', async (req, res) => {
  const result = await assetService.netWorth(req.user.id)
  return ok(res, result)
})

router.get('/:id', async (req, res) => {
  const result = await assetService.getAsset({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

router.patch('/:id', async (req, res) => {
  const data = parse(updateAssetSchema, req.body)
  const result = await assetService.updateAsset({ userId: req.user.id, id: req.params.id, data })
  return ok(res, result)
})

router.delete('/:id', async (req, res) => {
  const result = await assetService.deleteAsset({ userId: req.user.id, id: req.params.id })
  return ok(res, result)
})

export default router