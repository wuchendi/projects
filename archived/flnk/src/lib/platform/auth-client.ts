import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // Falls back to the current origin when unset.
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
})

export const { signIn, signOut, useSession } = authClient
