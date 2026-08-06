import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test', ACCESS_TOKEN_SECRET: 'test-access-secret-at-least-thirty-two-characters', REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-thirty-two-characters' } } })
