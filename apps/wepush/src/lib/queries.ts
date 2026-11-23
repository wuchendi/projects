import type { Template, User } from '@/database/schema'

// Client-side list fetchers shared by the console pages and the shell's space
// panels, so both read the same react-query cache (`['users']`,
// `['templates']`).

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=200&offset=0')
  if (!res.ok) throw new Error('Failed to load users')
  const data = (await res.json()) as { rows: User[] }
  return data.rows
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch('/api/templates')
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json()
}
