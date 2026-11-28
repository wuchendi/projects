export interface TemplateVariableValue {
  value: string
  color?: string
}

export type TemplateData = Record<string, TemplateVariableValue>

export interface TemplateInput {
  title: string
  desc: string
}

export interface RenderedTemplate {
  title: string
  desc: string
  wechatData: Record<string, { value: string; color: string }>
}

const DEFAULT_COLORS: Record<string, string> = {
  date: '#2E8B57',
  city: '#4682B4',
  weather: '#FF6347',
  max_temperature: '#FF4500',
  min_temperature: '#4169E1',
  temperature: '#FF6347',
  humidity: '#1E90FF',
  wind_direction: '#32CD32',
  wind_scale: '#FFD700',
  pm25: '#FF8C00',
  pm10: '#FF8C00',
  air_quality: '#20B2AA',
  aqi: '#20B2AA',
  sunrise: '#FFA500',
  sunset: '#DC143C',
  notice: '#708090',
  ganmao: '#708090',
  birthday_message: '#FF69B4',
  moment_copyrighting: '#9370DB',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function renderTemplate(
  template: TemplateInput,
  data: TemplateData,
  options: { showColor: boolean } = { showColor: true },
): RenderedTemplate {
  let { title, desc } = template
  const wechatData: Record<string, { value: string; color: string }> = {}

  for (const [key, raw] of Object.entries(data)) {
    const value = raw?.value ?? ''
    const colorFallback =
      DEFAULT_COLORS[key] ??
      (key.startsWith('birthday_') ? DEFAULT_COLORS.birthday_message : null) ??
      '#000000'
    const color = options.showColor ? (raw?.color ?? colorFallback) : '#000000'
    const pattern = new RegExp(`\\{\\{${escapeRegex(key)}\\.DATA\\}\\}`, 'g')
    title = title.replace(pattern, value)
    desc = desc.replace(pattern, value)
    wechatData[key] = { value, color }
  }

  // The rendered body split into `c1`..`c10`, so the WeChat-side template can
  // be just those ten placeholders: it stays under WeChat's 600-character
  // template limit however long the wepush template grows, and each value
  // stays short enough for WeChat to show (a ~400-character value rendered
  // blank). Set last so these keys always win over same-named variables.
  const chunks = toWechatChunks(desc)
  for (let i = 0; i < CONTENT_SLOTS; i++) {
    wechatData[`c${i + 1}`] = { value: chunks[i] ?? '', color: '#000000' }
  }

  return { title, desc, wechatData }
}

const CONTENT_SLOTS = 10
const CONTENT_CHUNK_CHARS = 100

// Packs whole lines into chunks of at most CONTENT_CHUNK_CHARS characters (a
// single longer line becomes its own chunk). Lines inside a chunk end with two
// spaces so WeChat keeps the line breaks; blank lines stay empty. Lines past
// the last slot are appended to it.
function toWechatChunks(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd())
  const chunks: string[][] = []
  let current: string[] = []
  let length = 0
  for (const line of lines) {
    const size = [...line].length + 3 // + "  \n"
    if (current.length > 0 && length + size > CONTENT_CHUNK_CHARS) {
      chunks.push(current)
      current = []
      length = 0
    }
    current.push(line)
    length += size
  }
  if (current.length > 0) chunks.push(current)
  const overflow = chunks.splice(CONTENT_SLOTS).flat()
  chunks[CONTENT_SLOTS - 1]?.push(...overflow)
  return chunks.map((chunk) =>
    chunk
      .map((line, i) => (line && i < chunk.length - 1 ? `${line}  ` : line))
      .join('\n'),
  )
}

export function extractVariableNames(text: string): string[] {
  const set = new Set<string>()
  const re = /\{\{([^}]+)\.DATA\}\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    set.add(match[1])
  }
  return Array.from(set)
}
