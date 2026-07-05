/**
 * POST /api/jarvis/voice
 * Text-to-speech endpoint. Uses ElevenLabs if ELEVENLABS_API_KEY and
 * ELEVENLABS_VOICE_ID are set; otherwise falls back to z-ai-web-dev-sdk TTS.
 *
 * GET returns the voice configuration status so the UI can show which
 * engine is active.
 */

import { NextRequest, NextResponse } from 'next/server'
import { speak } from '@/lib/jarvis/brain'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    const { audio, contentType, engine } = await speak(String(text))
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audio.length),
        'X-Voice-Engine': engine,
        'Cache-Control': 'no-store'
      }
    })
  } catch (err) {
    console.error('Voice error:', err)
    return NextResponse.json({ error: 'Voice synthesis failed', detail: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    elevenlabsConfigured: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? null,
    fallbackEngine: 'z-ai-web-dev-sdk (tongtong voice)',
    instructions: 'Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your environment. Use the Voice Setup panel to clone the JARVIS voice from samples.'
  })
}
