'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mic, ExternalLink, CheckCircle2, AlertCircle, Volume2, Loader2 } from 'lucide-react'

interface VoiceConfig {
  elevenlabsConfigured: boolean
  elevenlabsVoiceId: string | null
  fallbackEngine: string
  instructions: string
}

// JARVIS voice samples sourced from the web — used to clone the voice in ElevenLabs.
// These are public film clip / interview references; the user should add the
// actual audio files (or URL refs) when cloning.
const JARVIS_VOICE_SAMPLES = [
  {
    title: 'JARVIS — "For you, sir, always." (Iron Man 2008)',
    description: 'The signature line. Pure RP British, measured pace, formal warmth.',
    searchHint: 'youtube: "Jarvis for you sir always Iron Man 2008"'
  },
  {
    title: 'JARVIS — Suit assembly dialogue (Iron Man 2)',
    description: 'Clinical phrasing with dry humor. Excellent for capturing deadpan delivery.',
    searchHint: 'youtube: "Jarvis suit up Iron Man 2"'
  },
  {
    title: 'JARVIS — "As you wish, sir." safety briefing (Iron Man 2)',
    description: 'Longer monologue showing proactive helpfulness + understated wit.',
    searchHint: 'youtube: "Jarvis safety briefing Iron Man 2"'
  },
  {
    title: 'Paul Bettany — RP interview samples',
    description: 'Natural conversational RP British for varied intonation data.',
    searchHint: 'youtube: "Paul Bettany interview British accent"'
  },
  {
    title: 'JARVIS — Avengers tower scenes (Avengers 2012)',
    description: 'Multi-turn tactical dialogue showing calm under pressure.',
    searchHint: 'youtube: "Jarvis Avengers tower scene"'
  },
  {
    title: 'JARVIS — Age of Ultron confrontation',
    description: 'Direct threat assessment: "I believe your intentions to be hostile."',
    searchHint: 'youtube: "Jarvis vs Ultron Age of Ultron"'
  }
]

export function VoiceSetupPanel() {
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/jarvis/voice')
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const testVoice = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await fetch('/api/jarvis/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'For you, sir, always. Voice subsystem operational.' })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const engine = resp.headers.get('X-Voice-Engine') ?? 'unknown'
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      await audio.play()
      setTestResult(`Voice synthesis successful. Engine: ${engine}.`)
    } catch (err) {
      setTestResult(`Voice test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading voice configuration...</div>
  }

  return (
    <div className="h-full overflow-y-auto jarvis-scroll">
      <div className="p-5 space-y-5 max-w-4xl mx-auto">

        <div className="text-center">
          <h2 className="font-display text-xl text-glow-soft text-primary">Voice Subsystem</h2>
          <p className="text-sm text-muted-foreground mt-1">ElevenLabs voice cloning for the iconic JARVIS timbre</p>
        </div>

        {/* Status */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              {config?.elevenlabsConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-display text-sm text-primary">
                  {config?.elevenlabsConfigured ? 'ElevenLabs Active' : 'Using Fallback TTS'}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {config?.elevenlabsConfigured
                    ? `Voice ID: ${config.elevenlabsVoiceId}`
                    : 'ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not set'}
                </p>
              </div>
            </div>
            <Button
              onClick={testVoice}
              disabled={testing}
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Volume2 className="h-3.5 w-3.5 mr-2" />}
              Test Voice
            </Button>
            {testResult && (
              <p className="mt-2 text-xs font-mono text-muted-foreground">{testResult}</p>
            )}
          </div>
        </Card>

        {/* Setup instructions */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <p className="font-display text-sm text-primary">Setup Protocol</p>
            <ol className="space-y-3">
              <Step
                num={1}
                title="Create an ElevenLabs account"
                detail="Sign up at elevenlabs.io. A free tier grants 10k characters/month; Creator tier ($11/mo) unlocks voice cloning."
                link={{ href: 'https://elevenlabs.io', label: 'elevenlabs.io' }}
              />
              <Step
                num={2}
                title="Source JARVIS voice samples"
                detail="Collect 1–5 minutes of clean JARVIS audio from the samples below. Higher quality = better cloning. Aim for varied intonation."
              />
              <Step
                num={3}
                title="Clone the voice in ElevenLabs"
                detail="Navigate to Voices → Add Voice → Voice Cloning → Instant Voice Clone. Upload your samples. Name it 'JARVIS'. Copy the resulting Voice ID."
                link={{ href: 'https://elevenlabs.io/app/voice-lab', label: 'Voice Lab' }}
              />
              <Step
                num={4}
                title="Set environment variables"
                detail={
                  <pre className="bg-background/60 border border-border/40 rounded p-2 text-[10px] font-mono overflow-x-auto">
{`# .env (or your deployment's secret manager)
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=xxxxxxxxxxxxxxxxxxxxxxxx`}
                  </pre>
                }
              />
              <Step
                num={5}
                title="Restart and verify"
                detail="Restart the JARVIS service. The Voice Setup panel will show 'ElevenLabs Active' with your Voice ID. Click 'Test Voice' to confirm."
              />
            </ol>
          </div>
        </Card>

        {/* Voice samples */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm text-primary">JARVIS Voice Samples (Web Sources)</p>
              <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary/70">CLONING REFERENCE</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Search for these clips on YouTube or your preferred source. Download the audio,
              trim to clean dialogue (no background music where possible), and upload to
              ElevenLabs Voice Lab. Target ~3–5 minutes total for best results.
            </p>
            <div className="space-y-2">
              {JARVIS_VOICE_SAMPLES.map((s, i) => (
                <div key={i} className="rounded border border-border/40 bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded border border-primary/40 bg-primary/10 flex items-center justify-center">
                      <Mic className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground/90">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
                      <p className="text-[10px] text-primary/60 font-mono mt-1">{s.searchHint}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recommended voice settings */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <p className="font-display text-sm text-primary">Recommended Voice Settings</p>
            <p className="text-xs text-muted-foreground">
              These settings are already applied in <code className="text-primary/80 font-mono">/lib/jarvis/brain.ts → speak()</code>.
              Tune them in the ElevenLabs Voice Lab UI to taste.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Setting name="Model" value="eleven_multilingual_v2" hint="Strong accent preservation" />
              <Setting name="Stability" value="0.45" hint="Varied but recognisable" />
              <Setting name="Similarity Boost" value="0.75" hint="Closer to source timbre" />
              <Setting name="Style" value="0.35" hint="Mild stylistic exaggeration" />
              <Setting name="Use Speaker Boost" value="true" hint="Enhances speaker similarity" />
              <Setting name="Output Format" value="audio/mpeg" hint="MP3 for compact streaming" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Step({ num, title, detail, link }: {
  num: number
  title: string
  detail: React.ReactNode
  link?: { href: string; label: string }
}) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
        <span className="text-[10px] font-mono text-primary">{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/90">{title}</p>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          {detail}
        </div>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-[11px] text-primary hover:text-primary/80"
          >
            {link.label} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </li>
  )
}

function Setting({ name, value, hint }: { name: string; value: string; hint: string }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-2">
      <p className="text-[10px] font-mono text-muted-foreground">{name}</p>
      <p className="text-xs font-mono text-primary mt-0.5">{value}</p>
      <p className="text-[9px] text-muted-foreground/70 mt-0.5">{hint}</p>
    </div>
  )
}
