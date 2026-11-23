import { Hono } from 'hono'
import * as z from 'zod'
import type { NewPlayerLog } from '@/database/schema'
import { playerLogs } from '@/database/schema'
import { useDrizzle } from '@/lib/db'

export const monitorRoutes = new Hono()

const PlayerLogSchema = z.object({
  time: z.number(),
  userId: z.number(),
  userIdUuid: z.string(),
  streamId: z.string(),
  version: z.string(),
  UA: z.string().optional(),
  vendor: z.string().optional(),
  platform: z.string().optional(),
  feature: z.string().optional(),
  playerConfig: z
    .object({
      topicId: z.number().optional(),
      env: z.string().optional(),
    })
    .catchall(z.unknown()),
  vplayerRuntime: z.record(z.string(), z.unknown()).optional(),
  playerRuntime: z.record(z.string(), z.unknown()).optional(),
  executeProgressInfos: z.array(z.record(z.string(), z.unknown())).optional(),
})

const PlayerLogsArraySchema = z.array(PlayerLogSchema)

monitorRoutes.post('/monitor', async (c) => {
  const db = useDrizzle(c)
  try {
    // 1. Get bury_content parameter
    const buryContent = c.req.query('bury_content')
    if (!buryContent) {
      logger.warn('Missing bury_content parameter')
      return c.json(
        {
          code: 400,
          message: 'Missing bury_content parameter',
        },
        400,
      )
    }

    // 2. Get request header information
    const ipAddress =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      c.req.header('X-Real-IP')
    const userAgent = c.req.header('User-Agent')
    const country = c.req.header('CF-IPCountry')

    // 3. Parse request body
    let body: any
    try {
      body = await c.req.json()
    } catch (error) {
      logger.error('Failed to parse request body', JSON.stringify({ error }))
      return c.json(
        {
          code: 400,
          message: 'Invalid JSON body',
        },
        400,
      )
    }

    // 4. Validate data format
    const parseResult = PlayerLogsArraySchema.safeParse(body)
    if (!parseResult.success) {
      logger.warn(
        'Invalid log data format',
        JSON.stringify({
          errors: parseResult.error.issues,
          body: JSON.stringify(body).substring(0, 200),
        }),
      )
      return c.json(
        {
          code: 400,
          message: 'Invalid log data format',
          errors: parseResult.error.issues,
        },
        400,
      )
    }

    const logs = parseResult.data

    // 5. Prepare data for insertion
    const insertData: NewPlayerLog[] = logs.map((log, index) => {
      let featureObj = null
      if (log.feature) {
        try {
          featureObj = JSON.parse(log.feature)
        } catch (e) {
          console.warn(`Failed to parse feature JSON at index ${index}`, {
            feature: log.feature.substring(0, 100),
            error: e,
          })
          featureObj = null
        }
      }

      return {
        userId: log.userId,
        userIdUuid: log.userIdUuid,
        streamId: log.streamId,
        topicId: log.playerConfig?.topicId ?? null,
        time: log.time,
        version: log.version,
        ua: log.UA ?? null,
        vendor: log.vendor ?? null,
        platform: log.platform ?? null,
        feature: featureObj,
        playerConfig: log.playerConfig,
        vplayerRuntime: log.vplayerRuntime ?? null,
        playerRuntime: log.playerRuntime ?? null,
        executeProgressInfos: log.executeProgressInfos ?? null,
        buryContent,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        country: country ?? null,
      }
    })

    // 6. Batch insert into database
    try {
      await db?.insert(playerLogs).values(insertData)

      logger.info(
        'Player logs inserted successfully',
        JSON.stringify({
          count: logs.length,
          buryContent,
          userIds: [...new Set(logs.map((l) => l.userId))],
          streamIds: [...new Set(logs.map((l) => l.streamId))],
        }),
      )

      return c.json({
        code: 0,
        message: 'ok',
      })
    } catch (dbError: any) {
      logger.error(
        'Database insertion failed',
        JSON.stringify({
          error: dbError.message,
          stack: dbError.stack,
          sampleData: insertData[0],
        }),
      )

      return c.json(
        {
          code: 500,
          message: 'Database insertion failed',
          error: dbError.message,
        },
        500,
      )
    }
  } catch (error: any) {
    logger.error(
      'Failed to process player logs',
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
    )

    return c.json(
      {
        code: 500,
        message: 'Internal server error',
        error: error.message,
      },
      500,
    )
  }
})
