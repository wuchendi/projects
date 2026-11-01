'use client'

import type { LaunchpadConfig } from '@/database/schema'
import { BrandingSection } from './design/branding-section'
import { PageSection } from './design/page-section'
import { ProfileSection } from './design/profile-section'
import { SocialsSection } from './design/socials-section'

interface DesignTabProps {
  config: LaunchpadConfig
  onChange: (config: LaunchpadConfig) => void
}

export function DesignTab({ config, onChange }: DesignTabProps) {
  const { theme, profile } = config

  function setTheme(patch: Partial<LaunchpadConfig['theme']>) {
    onChange({ ...config, theme: { ...theme, ...patch } })
  }
  function setProfile(patch: Partial<LaunchpadConfig['profile']>) {
    onChange({ ...config, profile: { ...profile, ...patch } })
  }

  const socials = config.socials ?? {
    items: [],
    iconColor: 'brand' as const,
    placement: 'top' as const,
  }
  function setSocials(patch: Partial<NonNullable<LaunchpadConfig['socials']>>) {
    onChange({ ...config, socials: { ...socials, ...patch } })
  }

  return (
    <div className="space-y-4">
      {/* ── Profile ──────────────────────────────────────────────── */}
      <ProfileSection profile={profile} setProfile={setProfile} />

      {/* ── Page ─────────────────────────────────────────────────── */}
      <PageSection theme={theme} setTheme={setTheme} />

      {/* ── Socials (page-level bar) ─────────────────────────────── */}
      <SocialsSection socials={socials} setSocials={setSocials} />

      {/* ── Branding ─────────────────────────────────────────────── */}
      <BrandingSection
        hideBranding={config.hideBranding}
        onChange={(hideBranding) => onChange({ ...config, hideBranding })}
      />
    </div>
  )
}
