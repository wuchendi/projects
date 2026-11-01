import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { GitHubIcon as Github } from '@cdlab/ui/icon'
import { cn } from '@cdlab/ui/lib/utils'
import BlurText from '@cdlab/ui/reactbits/BlurText'
import CountUp from '@cdlab/ui/reactbits/CountUp'
import GradientText from '@cdlab/ui/reactbits/GradientText'
import {
  ArrowRight,
  BarChart3,
  Copy,
  Globe2,
  LineChart,
  Link2,
  Lock,
  PlusCircle,
  QrCode,
  Route,
  Server,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Faq } from '@/components/landing/faq'
import { ThreadsBackdrop } from '@/components/landing/threads-backdrop'
import { FlnkLogo, LocaleSwitcher, ThemeToggle } from '@/components/layout'
import { getConfig } from '@/lib/platform/env'

const GITHUB_HREF = 'https://github.com/WuChenDi/projects/tree/main/archived/flnk'
const AUTHOR_HREF = 'https://github.com/WuChenDi'

// Fixed full-page backdrop: a subtle grid washed with violet corner glows
// (adapted from patterncraft's "Grid Quad Purple Glow"). Two theme-specific
// layers so it reads on both light and dark without touching shared globals.
function PageBackground() {
  const grid =
    'linear-gradient(to right, VAR 1px, transparent 1px), linear-gradient(to bottom, VAR 1px, transparent 1px)'
  const size = '96px 64px, 96px 64px, 100% 100%, 100% 100%, 100% 100%'
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 dark:hidden"
        style={{
          background: '#ffffff',
          backgroundImage: `${grid.replaceAll('VAR', '#eef0f4')}, radial-gradient(circle 600px at 0% 200px, #e9e3ff, transparent), radial-gradient(circle 600px at 100% 200px, #e9e3ff, transparent), radial-gradient(circle 700px at 50% -100px, #ece7ff, transparent)`,
          backgroundSize: size,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden dark:block"
        style={{
          background: '#000000',
          backgroundImage: `${grid.replaceAll('VAR', 'rgba(255,255,255,0.05)')}, radial-gradient(circle 600px at 0% 200px, rgba(99,102,241,0.18), transparent), radial-gradient(circle 600px at 100% 200px, rgba(168,85,247,0.16), transparent), radial-gradient(circle 700px at 50% -100px, rgba(99,102,241,0.12), transparent)`,
          backgroundSize: size,
        }}
      />
    </>
  )
}

// Left-aligned section heading with a numbered eyebrow (e.g. "01 — Performance").
function SectionHeading({
  index,
  eyebrow,
  title,
  subtitle,
}: {
  index: string
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
        {index} — {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
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

export default async function LandingPage() {
  // When HOME_URL is configured, the root path redirects there instead of
  // rendering the landing page.
  const { homeURL } = getConfig()
  if (homeURL) redirect(homeURL)

  const t = await getTranslations('landing')
  const tc = await getTranslations('common')

  const features = [
    { key: 'routing', icon: Smartphone },
    { key: 'analytics', icon: BarChart3 },
    { key: 'realtime', icon: Globe2 },
    { key: 'ai', icon: Sparkles },
    { key: 'control', icon: Lock },
    { key: 'serverless', icon: Server },
  ] as const

  const stats = [
    { key: 'locations', to: 300, suffix: '+' },
    { key: 'features', to: 12, suffix: '' },
    { key: 'trackers', to: 0, suffix: '' },
  ] as const

  const steps = [
    { key: 'create', icon: PlusCircle },
    { key: 'route', icon: Route },
    { key: 'track', icon: LineChart },
  ] as const

  const faqKeys = [
    'cost',
    'deploy',
    'domain',
    'geo',
    'expiry',
    'ai',
    'import',
    'data',
    'privacy',
    'auth',
  ] as const
  const faqItems = faqKeys.map((k) => ({
    q: t(`faq.items.${k}.q`),
    a: t(`faq.items.${k}.a`),
  }))

  return (
    <div className="flex min-h-screen flex-col">
      <PageBackground />
      <header className="mx-auto flex h-20 w-full max-w-6xl shrink-0 items-center justify-between gap-2 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FlnkLogo className="size-6" />
          {tc('appName')}
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="outline" size="icon" aria-label="GitHub">
            <a href={GITHUB_HREF} target="_blank" rel="noopener noreferrer">
              <Github className="size-4" />
            </a>
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              {tc('enterDashboard')}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <ScrollArea className="h-[calc(100dvh-80px)] w-full [&_[data-slot=scroll-area-viewport]>*]:!block">
        <div className="w-full min-w-0">
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
              <ThreadsBackdrop
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
                ✨ {t('badge')}
              </GradientText>

              <h1 className="sr-only">
                {t('titleLead')} {t('titleHighlight')}
              </h1>
              <div
                aria-hidden
                className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl"
              >
                <BlurText
                  text={`${t('titleLead')} ${t('titleHighlight')}`}
                  animateBy="words"
                  delay={120}
                  className="justify-center text-balance"
                />
              </div>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t('subtitle')}
              </p>

              <div className="mt-9 flex items-center justify-center flex-row gap-3">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    {t('getStarted')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a
                    href={GITHUB_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="size-4" />
                    {tc('viewSource')}
                  </a>
                </Button>
              </div>

              {/* Decorative link preview */}
              <div className="mx-auto mt-14 w-full max-w-xl rounded-xl border p-2 shadow-sm backdrop-blur">
                <InputGroup className="border-none">
                  <InputGroupAddon>
                    <Link2 />
                  </InputGroupAddon>
                  <InputGroupInput
                    readOnly
                    value="https://flnk.cdlab.workers.dev/"
                    aria-label="Long URL"
                    className="font-mono text-xs md:text-sm"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton variant="default">
                      <Sparkles />
                      Shorten
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono text-muted-foreground">
                      s.ink/
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      launch
                    </span>
                    <Badge variant="secondary">AI</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      aria-label="Copy"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      aria-label="QR code"
                    >
                      <QrCode className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      aria-label="Analytics"
                    >
                      <BarChart3 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <SectionHeading
              index="01"
              eyebrow={t('featuresEyebrow')}
              title={t('featuresTitle')}
              subtitle={t('featuresSubtitle')}
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = f.icon
                return (
                  <div
                    key={f.key}
                    className="group relative flex min-h-40 flex-col justify-between gap-6 border bg-gradient-to-b from-muted/40 to-transparent p-5 text-left transition-colors hover:border-primary/40"
                  >
                    <CardCorners />
                    <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-background/60 text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold">
                        {t(`features.${f.key}.title`)}
                      </h3>
                      <p className="text-sm leading-snug text-muted-foreground">
                        {t(`features.${f.key}.desc`)}
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
              index="02"
              eyebrow={t('steps.eyebrow')}
              title={t('steps.title')}
              subtitle={t('steps.subtitle')}
            />
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.key}
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
                    <h3 className="mt-4 font-semibold">
                      {t(`steps.items.${step.key}.title`)}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t(`steps.items.${step.key}.desc`)}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Stats */}
          <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <SectionHeading
              index="03"
              eyebrow={t('stats.eyebrow')}
              title={t('stats.title')}
              subtitle={t('stats.subtitle')}
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.key} className="text-left">
                  <div className="flex items-baseline text-4xl font-bold tracking-tight md:text-5xl">
                    <CountUp to={s.to} duration={2} />
                    {s.suffix}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`stats.items.${s.key}.label`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12 md:px-6 md:py-20">
            <div className="md:sticky md:top-6 md:self-start">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
                04 — {t('faq.eyebrow')}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                {t('faq.title')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t('faq.subtitle')}
              </p>
            </div>
            <Faq items={faqItems} />
          </section>

          {/* CTA */}
          <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="relative isolate overflow-hidden rounded-xl border bg-card/60 px-6 py-14 text-center md:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-30 dark:opacity-50"
                style={{
                  maskImage:
                    'radial-gradient(ellipse 70% 80% at 50% 50%, #000 20%, transparent 70%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 70% 80% at 50% 50%, #000 20%, transparent 70%)',
                }}
              >
                <ThreadsBackdrop
                  color={[0.45, 0.5, 0.72]}
                  amplitude={1}
                  distance={0}
                  enableMouseInteraction={false}
                />
              </div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
                {t('cta.eyebrow')}
              </p>
              <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
                {t('cta.title')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                {t('cta.subtitle')}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    {t('cta.button')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a
                    href={GITHUB_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="size-4" />
                    {tc('viewSource')}
                  </a>
                </Button>
              </div>
            </div>
          </section>

          <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 md:px-6">
            <div className="flex flex-col gap-10 md:flex-row md:justify-between">
              <div className="max-w-xs space-y-3">
                <Link
                  href="/"
                  className="flex items-center gap-2 font-semibold"
                >
                  <FlnkLogo className="size-6" />
                  {tc('appName')}
                </Link>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t('footer.blurb')}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-16 gap-y-10">
                <nav className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    {t('footer.product')}
                  </p>
                  <ul className="space-y-2.5 text-sm">
                    <li>
                      <Link
                        href="/dashboard"
                        className="text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {t('footer.dashboard')}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dashboard/analytics"
                        className="text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {tc('appName')} Analytics
                      </Link>
                    </li>
                  </ul>
                </nav>

                <nav className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    {t('footer.resources')}
                  </p>
                  <ul className="space-y-2.5 text-sm">
                    <li>
                      <Link
                        href="/dashboard/privacy"
                        className="text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {t('footer.privacy')}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dashboard/terms"
                        className="text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {t('footer.terms')}
                      </Link>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                © {new Date().getFullYear()}-PRESENT ·{' '}
                <a
                  href={AUTHOR_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  wudi
                </a>
              </span>
              <span className="font-mono text-muted-foreground/70">
                {t('footer.builtWith')}
              </span>
            </div>
          </footer>
        </div>
      </ScrollArea>
    </div>
  )
}
