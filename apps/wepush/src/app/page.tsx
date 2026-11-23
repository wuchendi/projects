import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cdlab/ui/components/accordion'
import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { IKPageContainer } from '@cdlab/ui/IK'
import { GitHubIcon as Github } from '@cdlab/ui/icon'
import { cn } from '@cdlab/ui/lib/utils'
import BlurText from '@cdlab/ui/reactbits/BlurText'
import GradientText from '@cdlab/ui/reactbits/GradientText'
import Threads from '@cdlab/ui/reactbits/Threads'
import {
  AlarmClock,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CloudSun,
  FileText,
  Gift,
  Heart,
  KeyRound,
  MessageSquareText,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { WepushLogo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'

const BRAND = 'wepush'
const GITHUB_HREF = 'https://github.com/WuChenDi/projects/tree/main/apps/wepush'
const AUTHOR_HREF = 'https://github.com/WuChenDi'

const FEATURES = [
  {
    icon: Users,
    title: '多接收人管理',
    desc: '为每个接收人单独配置城市、纪念日与模板变量，集中维护推送名单。',
  },
  {
    icon: FileText,
    title: '可视化模板',
    desc: '在界面中编辑 {{var.DATA}} 模板与颜色，无需改代码即可调整推送内容。',
  },
  {
    icon: CalendarClock,
    title: '定时与农历',
    desc: '基于 Cron 定时推送，内置公历 / 农历纪念日倒数，自动换算下一次发送日期。',
  },
  {
    icon: CloudSun,
    title: '内置数据源',
    desc: '天气、一言、每日英语等数据源开箱即用，自动注入到模板变量中。',
  },
  {
    icon: ScrollText,
    title: '推送日志',
    desc: '按批次记录每次推送的成功 / 失败明细，支持重试与详情追踪。',
  },
  {
    icon: KeyRound,
    title: '访问控制',
    desc: '账号登录（Google / GitHub）保护控制台，数据按账号隔离，推送接口由独立 Token 鉴权。',
  },
]

const STEPS = [
  {
    icon: Settings,
    title: '配置公众号',
    desc: '在设置中填入测试号 AppID / AppSecret，建立与微信的连接。',
  },
  {
    icon: Users,
    title: '添加接收人与模板',
    desc: '维护接收人名单，绑定模板与个性化变量（城市、纪念日等）。',
  },
  {
    icon: CalendarClock,
    title: '设置定时任务',
    desc: '开启 Cron 定时，或随时手动 / 通过 API 触发一次推送。',
  },
  {
    icon: ScrollText,
    title: '查看推送结果',
    desc: '在日志中查看每个批次的发送明细，失败可一键重试。',
  },
]

const MESSAGE_LINES = [
  { label: '城市', value: '杭州 · 多云', color: 'text-sky-500' },
  { label: '气温', value: '18 ~ 26℃', color: 'text-amber-500' },
  { label: '农历', value: '五月初七', color: 'text-emerald-500' },
  { label: '在一起', value: '已经 1024 天', color: 'text-rose-500' },
  { label: '距生日', value: '还有 12 天', color: 'text-rose-500' },
  {
    label: '每日一言',
    value: '愿你被这个世界温柔以待。',
    color: 'text-primary',
  },
  {
    label: 'English',
    value: 'Stay hungry, stay foolish.',
    color: 'text-primary',
  },
]

const USE_CASES = [
  {
    icon: Heart,
    title: '给家人 / 恋人',
    desc: '每天清晨送上问候，附带天气、纪念日倒数与暖心一言。',
  },
  {
    icon: Gift,
    title: '纪念日不遗忘',
    desc: '公历 / 农历纪念日自动倒数，重要的日子提前提醒。',
  },
  {
    icon: AlarmClock,
    title: '个人提醒',
    desc: '给自己推送天气、待办与每日英语，开启自律的一天。',
  },
]

const OLD_WAY = [
  '配置写死在代码 / 环境变量里',
  '改一次推送内容就要改代码并重新部署',
  '多账号、多模板难以维护',
  '没有推送记录，失败难以排查',
]

const NEW_WAY = [
  '接收人 / 模板 / 设置全部入库，界面直接编辑',
  '改完即时生效，无需重新部署',
  '多接收人、多模板各自独立配置',
  '批次日志可视化，失败一键重试',
]

const FAQS = [
  {
    q: '需要自己的服务器吗？',
    a: '不需要。部署在 Cloudflare Workers（OpenNext），数据存 D1，零运维、零账单门槛。',
  },
  {
    q: '支持哪些消息类型？',
    a: '微信公众号测试号的模板消息，支持 {{var.DATA}} 变量替换与颜色样式。',
  },
  {
    q: '推送的数据从哪来？',
    a: '内置天气、一言、每日英语等数据源，按每个接收人的配置自动注入到模板变量。',
  },
  {
    q: '怎么实现定时？',
    a: '基于 Cloudflare Cron 定时触发，也支持手动 / API 触发，并可随时暂停或恢复。',
  },
  {
    q: '数据安全吗？',
    a: '控制台需账号登录，数据按账号隔离、互不可见；推送接口独立 Token 鉴权，AppSecret 等敏感项在接口返回时自动脱敏。',
  },
]

const STACK = [
  'Next.js',
  'Cloudflare Workers',
  'D1',
  'Drizzle ORM',
  'OpenNext',
  'Cron Triggers',
]

const FOOTER_COLUMNS = [
  {
    title: '控制台',
    links: [
      { label: '概览', href: '/dashboard', icon: BarChart3, external: false },
      {
        label: '接收人',
        href: '/dashboard/users',
        icon: Users,
        external: false,
      },
      {
        label: '模板',
        href: '/dashboard/templates',
        icon: FileText,
        external: false,
      },
      {
        label: '日志',
        href: '/dashboard/logs',
        icon: ScrollText,
        external: false,
      },
    ],
  },
  {
    title: '资源',
    links: [
      {
        label: '服务条款',
        href: '/terms',
        icon: FileText,
        external: false,
      },
      {
        label: '隐私政策',
        href: '/privacy',
        icon: ShieldCheck,
        external: false,
      },
    ],
  },
]

// Fixed full-page backdrop: a fine dot grid lit by a single top-center glow
// (patterncraft "Dotted + Top Glow" family). Two theme-specific layers so it
// reads on both light and dark.
function PageBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 dark:hidden"
        style={{
          background: '#ffffff',
          backgroundImage:
            'radial-gradient(circle, rgba(99,102,241,0.10) 1px, transparent 1px), radial-gradient(ellipse 80% 55% at 50% -10%, rgba(165,180,252,0.40), transparent 70%)',
          backgroundSize: '22px 22px, 100% 100%',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden dark:block"
        style={{
          background: '#000000',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(ellipse 80% 55% at 50% -10%, rgba(99,102,241,0.22), transparent 70%)',
          backgroundSize: '22px 22px, 100% 100%',
        }}
      />
    </>
  )
}

// Left-aligned section heading with a numbered eyebrow (e.g. "01 — 核心能力").
function SectionHeading({
  index,
  eyebrow,
  title,
  subtitle,
  className,
  children,
}: {
  index: string
  eyebrow: string
  title: string
  subtitle: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
        {index} — {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  )
}

// Animated corner brackets, drawn on every feature card. Decorative only.
function CardCorners() {
  const base =
    'pointer-events-none absolute size-2.5 border-foreground/20 transition-colors group-hover:border-primary/50'
  return (
    <>
      <span className={cn(base, 'left-0 top-0 border-l border-t')} />
      <span className={cn(base, 'right-0 top-0 border-r border-t')} />
      <span className={cn(base, 'bottom-0 left-0 border-b border-l')} />
      <span className={cn(base, 'bottom-0 right-0 border-b border-r')} />
    </>
  )
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageBackground />
      <header className="mx-auto flex h-20 w-full max-w-6xl shrink-0 items-center justify-between gap-2 px-4 md:px-6">
        <Link href="/" className="flex items-center font-semibold">
          <WepushLogo className="mr-2 size-6 text-primary" />
          {BRAND}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            aria-label="GitHub"
            nativeButton={false}
            render={
              <a href={GITHUB_HREF} target="_blank" rel="noopener noreferrer" />
            }
          >
            <Github className="size-4" />
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            进入控制台
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </header>

      <IKPageContainer className="flex-col p-0 md:px-0">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          {/* Subtle animated threads backdrop, masked to fade out */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-40 dark:opacity-60"
            style={{
              maskImage:
                'radial-gradient(ellipse 60% 70% at 50% 30%, #000 30%, transparent 75%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 60% 70% at 50% 30%, #000 30%, transparent 75%)',
            }}
          >
            <Threads
              color={[0.45, 0.5, 0.72]}
              amplitude={1.1}
              distance={0.1}
              enableMouseInteraction={false}
            />
          </div>

          <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center md:px-6 md:py-24">
            <GradientText
              showBorder
              colors={['#6366f1', '#a855f7', '#ec4899', '#a855f7', '#6366f1']}
              className="mb-6 border border-border text-xs tracking-wide md:text-sm"
            >
              ✨ 微信公众号 · 模板消息推送
            </GradientText>

            <h1 className="sr-only">把每日提醒交给 wepush</h1>
            <div
              aria-hidden
              className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl"
            >
              <BlurText
                text="把每日提醒交给 wepush"
                animateBy="words"
                delay={120}
                className="justify-center text-balance"
              />
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              多接收人、多模板、农历纪念日、天气与每日一言，全部在界面中配置，到点自动发送。
            </p>

            <div className="mt-9 flex items-center justify-center gap-3">
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href="/dashboard" />}
              >
                进入控制台
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={
                  <a
                    href={GITHUB_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <Github className="size-4" />
                查看源码
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            index="01"
            eyebrow="核心能力"
            title="推送链路上需要的能力，开箱即用"
            subtitle="从接收人、模板到定时与日志，一站式覆盖完整推送流程。"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group relative flex min-h-40 flex-col justify-between gap-6 border bg-gradient-to-b from-muted/40 to-transparent p-5 text-left transition-colors hover:border-primary/40"
                >
                  <CardCorners />
                  <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-background/60 text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="text-sm leading-snug text-muted-foreground">
                      {f.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Message preview */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <SectionHeading
              index="02"
              eyebrow="推送内容预览"
              title="一条消息，说清今天的一切"
              subtitle="把天气、农历、纪念日倒数、每日一言与英语组合成一条模板消息，变量自动替换、关键字段着色。每个接收人都能收到专属于自己的内容。"
            >
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquareText className="size-4 text-primary" />
                变量随接收人配置动态生成
              </div>
            </SectionHeading>

            <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 border-b bg-primary/5 px-5 py-3">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Send className="size-3.5" />
                </span>
                <span className="text-sm font-semibold">今日提醒</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  07:30
                </span>
              </div>
              <div className="divide-y">
                {MESSAGE_LINES.map((line) => (
                  <div
                    key={line.label}
                    className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {line.label}
                    </span>
                    <span className={`font-medium ${line.color}`}>
                      {line.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t bg-muted/30 px-5 py-2.5 text-center text-xs text-muted-foreground">
                来自 wepush 的每日推送
              </div>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            index="03"
            eyebrow="适用场景"
            title="日复一日的提醒，交给它自动完成"
            subtitle="无论是给在意的人，还是给自己，都能稳定地按时送达。"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {USE_CASES.map((u) => {
              const Icon = u.icon
              return (
                <div
                  key={u.title}
                  className="group relative flex min-h-40 flex-col justify-between gap-6 border bg-gradient-to-b from-muted/40 to-transparent p-5 text-left transition-colors hover:border-primary/40"
                >
                  <CardCorners />
                  <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-background/60 text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-semibold">{u.title}</h3>
                    <p className="text-sm leading-snug text-muted-foreground">
                      {u.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            index="04"
            eyebrow="四步开始"
            title="从接入公众号到自动发送"
            subtitle="只需几分钟，即可让每日推送稳定跑起来。"
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <div
                  key={s.title}
                  className="group relative rounded-xl border bg-card/60 p-6 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-4xl font-bold text-muted-foreground/15">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Comparison */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            index="05"
            eyebrow="告别青龙脚本"
            title="从写死配置的脚本，升级为可视化控制台"
            subtitle="同样的能力，更低的维护成本与更清晰的可观测性。"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border bg-card/60 p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-muted-foreground">
                <X className="size-4" />
                以前：ALL_CONFIG + 青龙脚本
              </h3>
              <ul className="space-y-3">
                {OLD_WAY.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  >
                    <X className="mt-0.5 size-4 shrink-0 text-destructive/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-primary/30 bg-card/60 p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Check className="size-4 text-primary" />
                现在：wepush 控制台
              </h3>
              <ul className="space-y-3">
                {NEW_WAY.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-12 md:px-6 md:py-20"
        >
          <div className="md:sticky md:top-6 md:self-start">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
              06 — 常见问题
            </p>
            <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight md:text-3xl">
              关于部署、推送与安全
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              几个快速解答，帮你判断它是否适合你。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {STACK.map((tech) => (
                <Badge key={tech} variant="secondary" className="font-normal">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
          <Accordion className="border-t">
            {FAQS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA */}
        <section className="relative mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24 border-t">
          <div className="relative isolate overflow-hidden rounded-xl border bg-card/60 px-6 py-14 text-center md:py-20">
            <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send className="size-5" />
            </div>
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold tracking-tight md:text-4xl">
              准备好发送第一条推送了吗？
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              进入控制台查看实时概览、配置接收人与模板，立即体验自动推送。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href="/dashboard" />}
              >
                进入控制台
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard" />}
              >
                <BarChart3 className="size-4" />
                查看概览
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="flex flex-col justify-between gap-12 py-12 md:flex-row md:py-16">
              <div className="flex max-w-sm flex-col gap-4">
                <Link href="/" className="flex items-center gap-2">
                  <WepushLogo className="size-6 text-primary" />
                  <span className="text-2xl font-semibold tracking-tight">
                    wepush
                  </span>
                </Link>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground/75">
                  微信公众号模板消息定时推送控制台 —
                  多接收人、多模板、农历纪念日，到点自动发送。
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Cloudflare Workers powered · 零运维部署
                </p>
              </div>

              <div className="flex gap-12 sm:gap-16 md:gap-20">
                {FOOTER_COLUMNS.map((column) => (
                  <div key={column.title} className="flex flex-col gap-3">
                    <span className="text-sm font-medium text-muted-foreground/60">
                      {column.title}
                    </span>
                    <ul className="flex flex-col gap-3">
                      {column.links.map((link) => {
                        const Icon = link.icon
                        return (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className="flex items-center gap-2 text-sm text-muted-foreground/75 transition-colors hover:text-foreground"
                              {...(link.external
                                ? {
                                    target: '_blank',
                                    rel: 'noopener noreferrer',
                                  }
                                : {})}
                            >
                              <Icon className="size-4" />
                              {link.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t py-6 text-xs text-muted-foreground/60 sm:flex-row sm:items-center sm:justify-between">
              <p>
                © Copyright 2026-PRESENT,{' '}
                <Link
                  href={AUTHOR_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  wudi
                </Link>
                . All Rights Reserved.
              </p>
              <span>Built with Next.js · Cloudflare Workers</span>
            </div>
          </div>
        </footer>
      </IKPageContainer>
    </div>
  )
}
