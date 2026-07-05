/**
 * POST /api/jarvis/research
 * Direct web research endpoint — for the standalone "Research" button.
 */

import { NextRequest, NextResponse } from 'next/server'
import { researchWeb } from '@/lib/jarvis/research'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { query, num, recencyDays, readPages } = await req.json()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })
    const result = await researchWeb(String(query), {
      num: Number(num) || 6,
      recencyDays: Number(recencyDays) || 30,
      readPages: Number(readPages) || 2
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('Research error:', err)
    return NextResponse.json({ error: 'Research failed', detail: String(err) }, { status: 500 })
  }
}
