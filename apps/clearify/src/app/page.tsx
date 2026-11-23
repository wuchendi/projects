'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@cdlab/ui/components/accordion'
import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { IKPageContainer } from '@cdlab/ui/IK'
import { GitHubIcon } from '@cdlab/ui/icon'
import { cn } from '@cdlab/ui/lib/utils'
import BlurText from '@cdlab/ui/reactbits/BlurText'
import CountUp from '@cdlab/ui/reactbits/CountUp'
import GradientText from '@cdlab/ui/reactbits/GradientText'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  CloudOff,
  Cpu,
  Download,
  FireExtinguisher,
  Gauge,
  Image,
  Lock,
  MousePointerClick,
  ShieldCheck,
  Video,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { useRef } from 'react'
import { ThreadsBackdrop } from '@/components/landing/threads-backdrop'
import { Footer } from '@/components/layout/footer'

const GITHUB_URL =
  'https://github.com/WuChenDi/projects/tree/main/apps/clearify'

interface Task {
  id: string
  title: string
  description: string
  icon: LucideIcon
  color: string
  route: string
}

const tasks: Task[] = [
  {
    id: 'remove-background',
    title: 'Remove Image Background',
    description:
      'Instantly remove backgrounds from any image using advanced AI. Perfect for portraits, product photos, and creating transparent images.',
    icon: Image,
    color: 'bg-gradient-to-r from-purple-500 to-blue-500',
    route: '/bg',
  },
  {
    id: 'squish',
    title: 'Image Squish',
    description:
      'Compress images up to 90% while maintaining quality. Fast browser-based processing with support for multiple formats including JPEG, PNG, and WebP.',
    icon: FireExtinguisher,
    color: 'bg-gradient-to-r from-orange-500 to-red-500',
    route: '/squish',
  },
  {
    id: 'compress',
    title: 'Video Compress',
    description:
      'Reduce video file sizes by up to 90% without quality loss. Fast browser-based compression with no uploads required.',
    icon: Video,
    color: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    route: '/compress',
  },
]

const features: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}[] = [
  {
    icon: ShieldCheck,
    title: 'Runs on your device',
    description:
      'Every pixel is processed locally with WebGPU, WebAssembly and Web Workers — no server round-trips.',
  },
  {
    icon: CloudOff,
    title: 'Nothing is uploaded',
    description:
      'Your photos and videos never leave the tab. There is no storage, no tracking, no account.',
  },
  {
    icon: Gauge,
    title: 'Up to 90% smaller',
    description:
      'Modern codecs squeeze files dramatically while keeping the detail you actually care about.',
  },
  {
    icon: GitHubIcon,
    title: 'Free & open source',
    description:
      'No paywalls, no limits, no sign-up. The full source is on GitHub for anyone to inspect.',
  },
]

const formats = ['JPEG', 'PNG', 'WebP', 'AVIF', 'JXL', 'MP4', 'MOV', 'AVI']

const stats: { to: number; suffix: string; label: string }[] = [
  { to: 90, suffix: '%', label: 'Smaller files' },
  { to: 0, suffix: '', label: 'Bytes uploaded' },
  { to: 8, suffix: '+', label: 'Formats supported' },
  { to: 100, suffix: '%', label: 'Free & open' },
]

const steps: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: MousePointerClick,
    title: 'Pick a tool',
    description:
      'Choose background removal, image squish or video compress — each opens instantly, no install.',
  },
  {
    icon: Cpu,
    title: 'Process in your browser',
    description:
      'Your file is decoded and re-encoded on-device with WebGPU & WebAssembly. It never touches a server.',
  },
  {
    icon: Download,
    title: 'Download the result',
    description:
      'Grab the optimized file right away. Close the tab and nothing is left behind.',
  },
]

const faqs = [
  {
    q: 'Are my files uploaded anywhere?',
    a: 'No. Everything runs locally in your browser using WebGPU, WebAssembly and Web Workers. Your files never leave your device and nothing is stored on a server.',
  },
  {
    q: 'How much smaller will my files get?',
    a: 'It depends on the source, but images and videos can shrink by up to 90% with modern codecs while keeping visual quality. You stay in control of the quality/size trade-off.',
  },
  {
    q: 'Which formats are supported?',
    a: 'Images: JPEG, PNG, WebP, AVIF and JXL. Video compression outputs MP4 (H.264 / H.265). Most common input formats are accepted.',
  },
  {
    q: 'Do I need an account or to pay?',
    a: 'Neither. Clearify is completely free, requires no sign-up, and the full source code is available on GitHub.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. Once the page has loaded and cached, the tools keep working without a network connection.',
  },
  {
    q: "What if my browser doesn't support WebGPU?",
    a: 'Background removal automatically falls back to a lighter model over WebAssembly (this also covers iOS Safari). It runs a bit slower than WebGPU, but still entirely on your device.',
  },
  {
    q: 'Can I process multiple files at once?',
    a: 'Remove Background and Image Squish both accept batch uploads and let you download everything as a single ZIP when done. Video Compress handles one video at a time.',
  },
  {
    q: 'Is there a file size limit?',
    a: "There's no hard limit — the real ceiling is your device's memory. Larger images and longer videos simply take more time to process, since everything runs on your CPU/GPU instead of a server.",
  },
  {
    q: 'Does video compression keep the audio?',
    a: "Yes, audio is re-encoded alongside the video by default. If your browser can't encode audio, Clearify warns you and outputs a muted file instead of failing.",
  },
]

// Left-aligned section heading with a numbered eyebrow (e.g. "01 — Why us").
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

export default function Home() {
  const toolsRef = useRef<HTMLDivElement>(null)

  const scrollToTools = () => {
    toolsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <IKPageContainer className="relative flex-col p-0 md:px-0">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
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
            ✨ 100% on-device · No uploads
          </GradientText>

          <h1 className="sr-only">
            Clearify — Powerful web-based tools for your image & video editing
            needs
          </h1>
          <div
            aria-hidden
            className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            <BlurText
              text="Powerful web-based tools for your image & video editing needs"
              animateBy="words"
              delay={120}
              className="justify-center text-balance"
            />
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Remove backgrounds, compress images and shrink videos — all in your
            browser. Nothing is sent to a server, ever.
          </p>

          <div className="mt-9 flex items-center justify-center gap-3">
            <Button size="lg" onClick={scrollToTools}>
              Explore the tools
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <GitHubIcon className="size-4" />
              Star on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Why Clearify */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          index="01"
          eyebrow="Why us"
          title="Why Clearify"
          subtitle="Privacy-first by design — speed and simplicity as a bonus."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative flex min-h-40 flex-col justify-between gap-6 border bg-gradient-to-b from-muted/40 to-transparent p-5 text-left transition-colors hover:border-primary/40"
            >
              <CardCorners />
              <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-background/60 text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                <feature.icon className="size-5" />
              </span>
              <div className="space-y-1.5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm leading-snug text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section
        ref={toolsRef}
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-20"
      >
        <SectionHeading
          index="02"
          eyebrow="Explore"
          title="Pick a tool, get to work"
          subtitle="Three focused utilities. No setup, no upload, no waiting."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={task.route}
              className="group relative flex min-h-48 flex-col justify-between gap-6 border bg-gradient-to-b from-muted/40 to-transparent p-5 text-left transition-colors hover:border-primary/40"
            >
              <CardCorners />
              <span
                className={cn(
                  'inline-flex size-10 items-center justify-center rounded-lg text-white',
                  task.color,
                )}
              >
                <task.icon className="size-5" />
              </span>
              <div className="space-y-1.5">
                <h3 className="font-semibold">{task.title}</h3>
                <p className="text-sm leading-snug text-muted-foreground">
                  {task.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Try it now
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          index="03"
          eyebrow="Process"
          title="How it works"
          subtitle="Three steps, zero servers."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="group relative rounded-xl border bg-card/60 p-6 transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-4xl font-bold text-muted-foreground/15">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          index="04"
          eyebrow="By the numbers"
          title="Built to stay out of your way"
          subtitle="Everything below happens without a server in sight."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-left">
              <div className="flex items-baseline text-4xl font-bold tracking-tight md:text-5xl">
                <CountUp to={stat.to} duration={2} />
                {stat.suffix}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="relative isolate overflow-hidden rounded-xl border bg-card/60 px-6 py-14 text-center md:py-16">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold tracking-tight md:text-3xl">
            Your files never leave your browser
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            There is no upload step. Files are decoded, transformed and encoded
            entirely on your machine, then handed straight back to you. Close
            the tab and nothing remains.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] md:gap-12 md:px-6 md:py-20">
        <SectionHeading
          index="05"
          eyebrow="Support"
          title="Frequently asked"
          subtitle="Everything you might wonder before dropping in a file."
          className="md:sticky md:top-6 md:self-start"
        >
          <div className="mt-6 flex flex-wrap gap-2">
            {formats.map((format) => (
              <Badge key={format} variant="secondary" className="font-normal">
                {format}
              </Badge>
            ))}
          </div>
        </SectionHeading>
        <Accordion className="border-t">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="relative mx-auto w-full max-w-6xl border-t px-4 py-16 md:px-6 md:py-24">
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
          <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold tracking-tight md:text-4xl">
            Ready to clean up your media?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Jump straight into any tool — it loads in the browser and works
            offline once cached.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {tasks.map((task) => (
              <Button
                key={task.id}
                variant="outline"
                nativeButton={false}
                render={<Link href={task.route} />}
              >
                <task.icon className="size-4" />
                {task.title}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <Footer />
      </div>
    </IKPageContainer>
  )
}
