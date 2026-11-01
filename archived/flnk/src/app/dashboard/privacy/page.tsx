import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-12 sm:px-5 sm:py-16 md:px-6">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mb-10">
          <Link
            href="/dashboard/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Back
          </Link>
          <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: June 17, 2026
          </p>
        </header>

        <div className="flex flex-col gap-8 text-[0.9375rem] leading-relaxed text-foreground/90 sm:text-base">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Overview
            </h2>
            <p>
              Flnk is a privacy-first link shortener with geo / device routing
              and edge analytics. We collect only what is necessary to operate
              the dashboard and run the service. This policy explains what data
              we collect, how we use it, and your rights.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Account Data
            </h2>
            <p>
              When you sign in with Google or GitHub OAuth, we receive and store
              your <strong>name</strong>, <strong>email address</strong>, and{' '}
              <strong>profile image URL</strong>. This information is used
              solely to identify your account and gate access to the dashboard.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Session Data
            </h2>
            <p>
              To maintain your session and for basic security purposes, we
              record your <strong>IP address</strong> and{' '}
              <strong>user agent</strong> string when you sign in. This data is
              tied to your session and is not used for tracking or profiling.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Link & Access Data
            </h2>
            <p>
              The short links you create (destination URLs, slugs, and routing
              configuration) are stored to operate the redirect service. When a
              short link is visited, we log aggregated access events to{' '}
              <strong>Cloudflare Analytics Engine</strong> — including
              coarse-grained geo, referrer, and browser / device information
              derived from the request — to power the dashboard analytics. Bot
              traffic logging can be disabled via configuration.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Data Storage
            </h2>
            <p>
              Application data (accounts, sessions, links) is stored in a SQLite
              database on <strong>Cloudflare D1</strong> or{' '}
              <strong>Turso</strong>. Analytics events are stored in Cloudflare
              Analytics Engine. Data is not replicated to third-party services
              beyond what is described in this policy.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Data Sharing
            </h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal
              information to third parties. Data is shared only with the
              infrastructure providers mentioned above (Cloudflare for hosting,
              analytics, and storage; Turso for database storage) as necessary
              to operate the service.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Your Rights
            </h2>
            <p>
              You can request deletion of your account and associated data at
              any time. Since authentication is handled through OAuth, you can
              also revoke access from your Google or GitHub account settings.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy from time to time. Changes will
              be reflected on this page with an updated date.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
