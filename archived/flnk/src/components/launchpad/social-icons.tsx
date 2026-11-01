// Curated social-platform registry. Brand glyphs live in the shared
// @cdlab/ui/icon package so every app draws from one source; this file only
// holds flnk's launchpad metadata (label + brand color) per platform. Each
// shared icon fills with currentColor so the renderer can paint it
// brand-colored or monochrome.
import {
  BilibiliIcon,
  DiscordIcon,
  FacebookIcon,
  GitHubIcon,
  GmailIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TelegramIcon,
  TikTokIcon,
  WeChatIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from '@cdlab/ui/icon'
import type { ComponentType, SVGProps } from 'react'

export interface SocialPlatform {
  id: string
  label: string
  color: string
  Icon: ComponentType<
    SVGProps<SVGSVGElement> & { size?: number; color?: string }
  >
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E4405F',
    Icon: InstagramIcon,
  },
  { id: 'x', label: 'X', color: '#000000', Icon: XIcon },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', Icon: FacebookIcon },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', Icon: YouTubeIcon },
  { id: 'tiktok', label: 'TikTok', color: '#000000', Icon: TikTokIcon },
  { id: 'telegram', label: 'Telegram', color: '#26A5E4', Icon: TelegramIcon },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', Icon: WhatsAppIcon },
  { id: 'spotify', label: 'Spotify', color: '#1DB954', Icon: SpotifyIcon },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', Icon: LinkedInIcon },
  { id: 'github', label: 'GitHub', color: '#181717', Icon: GitHubIcon },
  { id: 'discord', label: 'Discord', color: '#5865F2', Icon: DiscordIcon },
  { id: 'gmail', label: 'Email', color: '#EA4335', Icon: GmailIcon },
  { id: 'bilibili', label: 'Bilibili', color: '#00A1D6', Icon: BilibiliIcon },
  { id: 'wechat', label: 'WeChat', color: '#07C160', Icon: WeChatIcon },
]

export const SOCIAL_MAP: Record<string, SocialPlatform> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p]),
)
