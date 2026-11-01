import { getAuth } from '@/lib/platform/auth'

export async function GET(req: Request) {
  const auth = await getAuth()
  return auth.handler(req)
}

export async function POST(req: Request) {
  const auth = await getAuth()
  return auth.handler(req)
}
