import { createClient } from '@libsql/client'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import type { Context } from 'hono'
import * as schema from '@/database/schema'

class DatabaseManager {
  static instance: DatabaseManager
  public db:
    | LibSQLDatabase<typeof schema>
    | DrizzleD1Database<typeof schema>
    | undefined

  constructor(c?: Context) {
    if (DatabaseManager.instance) {
      return DatabaseManager.instance
    }
    DatabaseManager.instance = this

    logger.info('Creating DatabaseManager instance')

    const {
      DB_TYPE = 'libsql',
      LIBSQL_URL = 'file:./web/database/data.db',
      LIBSQL_AUTH_TOKEN,
    } = process.env

    logger.info(`DB_TYPE: ${DB_TYPE}`)

    switch (DB_TYPE) {
      case 'libsql': {
        const client = createClient({
          url: LIBSQL_URL,
          authToken: LIBSQL_AUTH_TOKEN,
        })
        this.db = drizzleSqlite(client, { schema })
        return this
      }
      case 'd1': {
        logger.info(
          c
            ? 'Using context for D1 database'
            : 'No context provided for D1 database',
        )
        if (!c?.env?.DB) {
          throw new Error('D1 database not found in context')
        }
        this.db = drizzleD1(c.env.DB, { schema })
        return this
      }
      default: {
        throw new Error(`Unsupported DB type: ${DB_TYPE}`)
      }
    }
  }
}

// Function to get DB instance in Hono routes
export function useDrizzle(c: Context) {
  return new DatabaseManager(c).db
}
