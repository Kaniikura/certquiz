import type { Hono } from 'hono'
import type { Redis } from 'ioredis'

export type AppEnv = {
  Variables: {
    redis?: Redis
    user?: {
      id: string
      email: string
      username: string
      role: 'guest' | 'user' | 'premium' | 'admin'
    }
  }
  Bindings: {
    JWT_SECRET: string
    DATABASE_URL: string
    REDIS_URL?: string
    KEYCLOAK_URL: string
    KEYCLOAK_REALM: string
    BMAC_WEBHOOK_SECRET: string
    API_PORT: number
    NODE_ENV: 'development' | 'production' | 'test'
    FRONTEND_URL: string
  }
}

export type App = Hono<AppEnv>