/**
 * GET /api/jarvis/brain
 * Reports which LLM engine is active (Anthropic Claude or z-ai SDK fallback)
 * and the configured model. Used by the UI to display the brain status.
 */

import { NextResponse } from 'next/server'
import { getBrainEngine } from '@/lib/jarvis/brain'

export const runtime = 'nodejs'

export async function GET() {
  const { engine, model } = getBrainEngine()
  return NextResponse.json({
    engine,
    model,
    anthropicConfigured: engine === 'anthropic',
    label: engine === 'anthropic' ? `Claude (${model})` : 'z-ai-web-dev-sdk (fallback)',
    instructions: engine === 'anthropic'
      ? 'ANTHROPIC_API_KEY is set. JARVIS is reasoning with Anthropic Claude.'
      : 'Set ANTHROPIC_API_KEY in .env to switch the brain to Anthropic Claude.'
  })
}
