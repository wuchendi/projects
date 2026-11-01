import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: June 17, 2026
          </p>
        </header>

        <div className="flex flex-col gap-8 text-[0.9375rem] leading-relaxed text-foreground/90 sm:text-base">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              About Flnk
            </h2>
            <p>
              Flnk is a privacy-first link shortener with geo / device routing
              and edge analytics. These terms govern your use of the Flnk
              dashboard and its associated services (accounts, link management,
              analytics).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              User Accounts
            </h2>
            <p>
              You may create an account by signing in with Google or GitHub
              OAuth. You are responsible for maintaining the security of your
              OAuth credentials. We reserve the right to suspend or terminate
              accounts that violate these terms or are used for abusive
              purposes.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Acceptable Use
            </h2>
            <p>
              You agree not to use Flnk to create or distribute links to content
              that is unlawful, malicious, deceptive, or that infringes the
              rights of others. We reserve the right to disable any short link
              or account that we consider abusive, including links flagged as
              unsafe by the built-in health checks.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Disclaimer of Warranties
            </h2>
            <p>
              Flnk is provided <strong>&quot;as is&quot;</strong> and{' '}
              <strong>&quot;as available&quot;</strong> without warranties of
              any kind, whether express or implied. We do not guarantee that the
              service will be error-free, uninterrupted, or free of defects. You
              use the service at your own risk.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, Flnk and its maintainers
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              service.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Changes to These Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Changes
              will be posted on this page with an updated date. Continued use of
              the service after changes are posted constitutes acceptance of the
              revised terms.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
