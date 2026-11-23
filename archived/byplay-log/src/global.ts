import * as winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const isDebug = process.env.NODE_ENV === 'dev'

interface SimpleLogger {
  debug: (message: string, ...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

declare global {
  var logger: SimpleLogger
  var isDebug: boolean
}

// logger
const logger =
  process.env.DEPLOY_RUNTIME === 'cf'
    ? {
        debug: (message: string, ...args: any[]) => {
          if (isDebug) console.log(`[DEBUG] ${message}`, ...args)
        },
        info: (message: string, ...args: any[]) => {
          console.log(`[INFO] ${message}`, ...args)
        },
        warn: (message: string, ...args: any[]) => {
          console.warn(`[WARN] ${message}`, ...args)
        },
        error: (message: string, ...args: any[]) => {
          console.error(`[ERROR] ${message}`, ...args)
        },
      }
    : winston.createLogger({
        level: isDebug ? 'debug' : 'info',
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize({ all: true }),
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} [${level}]: ${message}`
              }),
            ),
          }),
          new DailyRotateFile({
            filename: 'logs/dropply-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ],
      })

globalThis.logger = logger
globalThis.isDebug = isDebug
