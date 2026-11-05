import { NextResponse } from 'next/server'
import { corsPreflight, withCors } from '@/lib/cors'
import { AVAILABLE_MODELS } from '@/lib/data'

export async function GET() {
  return withCors(NextResponse.json(AVAILABLE_MODELS))
}

export function OPTIONS() {
  return corsPreflight()
}
