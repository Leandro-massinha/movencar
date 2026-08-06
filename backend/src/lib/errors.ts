import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { logger } from '../config/logger.js'

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message) }
}
export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void handler(req, res, next).catch(next)
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dados invalidos.', details: error.flatten() }, requestId: req.id })
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details }, requestId: req.id })
  logger.error({ err: error, requestId: req.id }, 'Unhandled request error')
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno.' }, requestId: req.id })
}
