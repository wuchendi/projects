import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'

const {
  DB_TYPE = 'libsql',
  CLOUDFLARE_ACCOUNT_ID = '',
  CLOUDFLARE_DATABASE_ID = '',
  CLOUDFLARE_API_TOKEN = '',
  LIBSQL_URL = 'file:./src/database/data.db',
  LIBSQL_AUTH_TOKEN = undefined,
} = process.env

const configFactory = {
  base: {
    schema: './src/database/schema.ts',
    out: './src/database',
  } as const,

  libsql: () =>
    ({
      ...configFactory.base,
      dialect: 'turso',
      dbCredentials: {
        url: LIBSQL_URL,
        authToken: LIBSQL_AUTH_TOKEN,
      },
    }) as const satisfies Config,

  d1: () =>
    ({
      ...configFactory.base,
      dialect: 'sqlite',
      driver: 'd1-http',
      dbCredentials: {
        accountId: CLOUDFLARE_ACCOUNT_ID,
        databaseId: CLOUDFLARE_DATABASE_ID,
        token: CLOUDFLARE_API_TOKEN,
      },
    }) as const satisfies Config,
} as const

const config =
  DB_TYPE === 'libsql' ? configFactory.libsql() : configFactory.d1()

export default defineConfig(config)
