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

  // The whole rendered body as one variable, so the WeChat-side template can
  // be just `{{content.DATA}}` and stay under its 600-character limit no
  // matter how long the wepush template grows. Set last so it always wins.
  wechatData.content = { value: toWechatLines(desc), color: '#000000' }

  return { title, desc, wechatData }
}

// WeChat only keeps a line break inside a variable value when the line ends
// with two spaces; without them the whole value renders blank. Pad every
// non-empty line (except the last) and leave blank lines empty.
function toWechatLines(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd())
  return lines
    .map((line, i) => (line && i < lines.length - 1 ? `${line}  ` : line))
    .join('\n')
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
