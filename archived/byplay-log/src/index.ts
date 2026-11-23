import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger as accesslog } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { requestId } from 'hono/request-id'
import { monitorRoutes } from '@/routes'
import './global'

const app = new Hono()

export const customLogger = (message: string, ...rest: string[]) => {
  logger.info(`[ACCESS] ${message}`, ...rest)
}

// Global middleware
app.use(accesslog(customLogger))
app.use('*', prettyJSON())
app.use('*', requestId())
app.use(
  '*',
  cors({
    origin: ['https://byplay.pages.dev', 'http://localhost:3016'],
    credentials: true,
  }),
)

app.route('/', monitorRoutes)

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    platform: 'cloudflare-workers',
    version: '1.0.0',
    message: 'Player Log Service',
    description: 'Video player monitoring and analytics service',
    timestamp: new Date().toISOString(),
    endpoints: {
      monitor: 'POST /monitor?bury_content=xxx',
    },
  })
})

// Global error handler
app.onError((err, c) => {
  logger.error('Global error handler invoked', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header('user-agent'),
  })

  if (err instanceof HTTPException) {
    logger.warn(`HTTP Exception: ${err.status} - ${err.message}`, {
      status: err.status,
      path: c.req.path,
      method: c.req.method,
    })

    return c.json(
      {
        code: err.status,
        message: err.message,
        stack: isDebug ? err.stack?.split('\n') : undefined,
      },
      err.status,
    )
  }

  logger.error('Unhandled server error', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

  return c.json(
    {
      code: 500,
      message: 'Internal Server Error',
      stack: isDebug ? err.stack?.split('\n') : undefined,
    },
    500,
  )
})

// 404 handler
app.notFound((c) => {
  logger.warn(`404 - Route not found: ${c.req.method} ${c.req.path}`, {
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header('user-agent'),
    referer: c.req.header('referer'),
  })

  return c.json(
    {
      code: 404,
      message: 'Not Found',
    },
    404,
  )
})

export default {
  fetch: app.fetch,
}
