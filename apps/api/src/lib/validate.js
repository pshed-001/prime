import { AppError, ErrorCodes, ErrorMessage } from '../lib/errors.js'

export function parse(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
    throw new AppError(ErrorCodes.VALIDATION_FAILED, ErrorMessage[ErrorCodes.VALIDATION_FAILED], {
      status: 422,
      details
    })
  }
  return result.data
}

export function parseParams(schema, input) {
  return parse(schema, input)
}