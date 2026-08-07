import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { corsOrigins } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './lib/prisma.js'
import { AppError, asyncHandler, errorHandler } from './lib/errors.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { tenantRouter } from './modules/tenancy/tenant.routes.js'
import { customersRouter } from './modules/customers/customers.routes.js'
import { vehiclesRouter } from './modules/vehicles/vehicles.routes.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use((req, res, next) => { req.id = req.get('x-request-id') || crypto.randomUUID(); res.setHeader('x-request-id', req.id); next() })
  app.use(pinoHttp({ logger }))
  app.use(helmet())
  app.use(cors({ credentials: true, origin(origin, callback) { callback(origin && !corsOrigins.includes(origin) ? new AppError(403, 'CORS_FORBIDDEN', 'Origem nao permitida.') : null, true) } }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.get('/api/health', asyncHandler(async (_req, res) => { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', service: 'movencar-api', timestamp: new Date().toISOString() }) }))
  app.use('/api/auth', authRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/vehicles', vehiclesRouter)
  app.use('/api', tenantRouter)
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Rota nao encontrada.')))
  app.use(errorHandler)
  return app
}
