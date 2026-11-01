import { Label } from '@cdlab/ui/components/label'
import { Switch } from '@cdlab/ui/components/switch'
import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Section } from './shared'

export function BrandingSection({
  hideBranding,
  onChange,
}: {
  hideBranding?: boolean
  onChange: (hideBranding: boolean) => void
}) {
  const t = useTranslations('launchpads')
  return (
    <Section icon={Sparkles} title={t('design.branding.title')}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm">{t('design.branding.showLogo')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('design.branding.hint')}
          </p>
        </div>
        <Switch checked={!hideBranding} onCheckedChange={(v) => onChange(!v)} />
      </div>
    </Section>
  )
}
