import { Input } from '@cdlab/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cdlab/ui/components/input-group'
import { Label } from '@cdlab/ui/components/label'
import { Textarea } from '@cdlab/ui/components/textarea'
import { User, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { LaunchpadConfig } from '@/database/schema'
import { Field, Section } from './shared'

export function ProfileSection({
  profile,
  setProfile,
}: {
  profile: LaunchpadConfig['profile']
  setProfile: (patch: Partial<LaunchpadConfig['profile']>) => void
}) {
  const t = useTranslations('launchpads')
  return (
    <Section icon={User} title={t('design.profile.title')}>
      <div className="flex items-start gap-3">
        {profile.avatar ? (
          // biome-ignore lint/performance/noImgElement: tiny inline preview of a user-supplied remote URL
          <img
            src={profile.avatar}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="size-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-xs">{t('design.profile.avatar')}</Label>
          <InputGroup>
            <InputGroupInput
              value={profile.avatar ?? ''}
              maxLength={2048}
              placeholder="https://…"
              onChange={(e) => setProfile({ avatar: e.target.value })}
            />
            {profile.avatar && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={t('design.profile.remove')}
                  onClick={() => setProfile({ avatar: '' })}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
      </div>

      <Field
        label={t('design.profile.name')}
        count={profile.name?.length ?? 0}
        max={128}
      >
        <Input
          value={profile.name ?? ''}
          maxLength={128}
          onChange={(e) => setProfile({ name: e.target.value })}
        />
      </Field>

      <Field
        label={t('design.profile.bio')}
        count={profile.bio?.length ?? 0}
        max={512}
      >
        <Textarea
          value={profile.bio ?? ''}
          maxLength={512}
          rows={2}
          onChange={(e) => setProfile({ bio: e.target.value })}
        />
      </Field>
    </Section>
  )
}
