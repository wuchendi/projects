import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const trackingFields = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  isDeleted: integer('is_deleted').notNull().default(0),
}

export const playerLogs = sqliteTable(
  'player_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Basic identification information
    userId: integer('user_id').notNull(),
    userIdUuid: text('user_id_uuid').notNull(),
    streamId: text('stream_id').notNull(),
    topicId: integer('topic_id'),

    // Report timestamp
    time: integer('time').notNull(),

    // Version information
    version: text('version').notNull(),

    // User agent information
    ua: text('ua'),
    vendor: text('vendor'),
    platform: text('platform'),

    // Device features
    feature: text('feature', { mode: 'json' }),

    // Player configuration
    playerConfig: text('player_config', { mode: 'json' }),

    // Runtime information
    vplayerRuntime: text('vplayer_runtime', { mode: 'json' }),
    playerRuntime: text('player_runtime', { mode: 'json' }),

    // Execution progress information
    executeProgressInfos: text('execute_progress_infos', { mode: 'json' }),

    // Request metadata
    buryContent: text('bury_content').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    country: text('country'),

    ...trackingFields,
  },
  (table) => [
    index('player_logs_user_id_idx').on(table.userId),
    index('player_logs_stream_id_idx').on(table.streamId),
    index('player_logs_time_idx').on(table.time),
    index('player_logs_bury_content_idx').on(table.buryContent),
    index('player_logs_created_at_idx').on(table.createdAt),
    index('player_logs_user_stream_idx').on(table.userId, table.streamId),
  ],
)

export type PlayerLog = typeof playerLogs.$inferSelect
export type NewPlayerLog = typeof playerLogs.$inferInsert
