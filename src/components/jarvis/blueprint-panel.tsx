'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Brain, Database, Mic, Search, Sparkles, Download, ExternalLink } from 'lucide-react'

interface Blueprint {
  title: string
  subtitle: string
  version: string
  pillars: Array<{
    id: string
    name: string
    tagline: string
    description: string
    components?: Array<{ name: string; detail: string }>
    tiers?: Array<{ name: string; horizon: string; capacity: string; mechanism: string; implementation: string; recall: string }>
    flow?: string[]
    pillars?: string[]
    signatureQuotes?: string[]
    sideNotes: string[]
  }>
  buildPhases: Array<{ phase: number; title: string; steps: string[]; sideNote: string }>
}

const PILLAR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  memory: Database,
  voice: Mic,
  research: Search,
  personality: Sparkles
}

export function BlueprintPanel() {
  const [bp, setBp] = useState<Blueprint | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jarvis/blueprint')
      .then(r => r.json())
      .then(d => { setBp(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading blueprint...</div>
  }
  if (!bp) {
    return <div className="p-8 text-center text-destructive font-mono text-sm">Failed to load blueprint.</div>
  }

  return (
    <div className="h-full overflow-y-auto jarvis-scroll">
      <div className="p-6 max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <p className="font-display text-[10px] tracking-[0.4em] text-primary/70">STARK INDUSTRIES · CLASSIFIED</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-glow-cyan text-primary">
            {bp.title}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">{bp.subtitle} · v{bp.version}</p>
          <div className="flex justify-center gap-2 pt-2">
            <a href="/api/jarvis/blueprint-pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                <Download className="h-3.5 w-3.5 mr-2" />
                Download Full PDF Blueprint
              </Button>
            </a>
            <a href="#architecture">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                View Architecture <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </a>
          </div>
        </div>

        {/* Architecture diagram */}
        <div id="architecture" className="hud-corner border border-primary/30 bg-card/30 p-6 rounded">
          <p className="font-display text-xs tracking-widest text-primary/80 mb-4">SYSTEM ARCHITECTURE</p>
          <ArchitectureDiagram pillars={bp.pillars} />
        </div>

        {/* Pillars */}
        <div className="space-y-6">
          <h2 className="font-display text-xl text-glow-soft">Core Pillars</h2>
          {bp.pillars.map((p) => {
            const Icon = PILLAR_ICONS[p.id] ?? Sparkles
            return (
              <Card key={p.id} className="bg-card/40 border-primary/25 hud-corner">
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded border border-primary/40 bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-lg text-primary">{p.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono italic">{p.tagline}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{p.description}</p>

                  {/* Components */}
                  {p.components && (
                    <div className="grid md:grid-cols-2 gap-2 mt-3">
                      {p.components.map((c, i) => (
                        <div key={i} className="rounded border border-border/40 bg-background/40 p-3">
                          <p className="text-xs font-mono text-primary/80 mb-1">{c.name}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tiers (memory) */}
                  {p.tiers && (
                    <div className="space-y-2 mt-3">
                      {p.tiers.map((t, i) => (
                        <div key={i} className="rounded border border-border/40 bg-background/40 p-3">
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <p className="text-sm font-mono text-primary">{t.name}</p>
                            <div className="flex gap-1.5">
                              <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary/70">{t.horizon}</Badge>
                              <Badge variant="outline" className="text-[9px] font-mono border-border/40 text-muted-foreground">CAP: {t.capacity}</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/80 mb-1">{t.mechanism}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">IMPL: {t.implementation}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">RECALL: {t.recall}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flow */}
                  {p.flow && (
                    <ol className="space-y-1.5 mt-3">
                      {p.flow.map((step, i) => (
                        <li key={i} className="flex gap-3 text-xs">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-foreground/80 pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {/* Pillars list (personality) */}
                  {p.pillars && (
                    <ul className="grid md:grid-cols-2 gap-1.5 mt-3">
                      {p.pillars.map((pil, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex gap-2">
                          <span className="text-primary">▸</span> {pil}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Signature quotes */}
                  {p.signatureQuotes && (
                    <div className="mt-3 space-y-1.5">
                      {p.signatureQuotes.map((q, i) => (
                        <blockquote key={i} className="text-xs italic text-primary/80 border-l-2 border-primary/40 pl-3">
                          "{q}"
                        </blockquote>
                      ))}
                    </div>
                  )}

                  {/* Side notes */}
                  <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-[10px] font-mono tracking-widest text-amber-500/80 mb-1.5">SIDE NOTES</p>
                    <ul className="space-y-1">
                      {p.sideNotes.map((n, i) => (
                        <li key={i} className="text-xs text-foreground/70 flex gap-2">
                          <span className="text-amber-500/70">◆</span> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Build phases */}
        <div className="space-y-4">
          <h2 className="font-display text-xl text-glow-soft">Build Phases</h2>
          <div className="space-y-3">
            {bp.buildPhases.map((phase) => (
              <div key={phase.phase} className="relative pl-8 pb-4 border-l border-primary/30 ml-3">
                <div className="absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                  <span className="text-[8px] font-mono text-primary">{phase.phase}</span>
                </div>
                <div className="rounded border border-border/40 bg-card/30 p-4">
                  <h3 className="font-display text-sm text-primary mb-3">{phase.title}</h3>
                  <ol className="space-y-1.5 mb-3">
                    {phase.steps.map((s, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-2">
                        <span className="text-muted-foreground/60 font-mono">{String(i + 1).padStart(2, '0')}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 mt-2">
                    <p className="text-[10px] text-amber-500/80 font-mono mb-0.5">SIDE NOTE</p>
                    <p className="text-xs text-foreground/70 italic">{phase.sideNote}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ArchitectureDiagram({ pillars }: { pillars: Blueprint['pillars'] }) {
  return (
    <div className="space-y-3">
      {/* User layer */}
      <div className="flex justify-center">
        <div className="rounded-full border-2 border-primary/50 bg-primary/10 px-6 py-2 text-center">
          <p className="font-display text-xs tracking-widest text-primary">USER</p>
          <p className="text-[10px] text-muted-foreground font-mono">text · voice</p>
        </div>
      </div>

      <Connector />

      {/* Brain layer */}
      <div className="flex justify-center">
        <div className="rounded border border-primary/40 bg-primary/5 px-5 py-3 text-center max-w-md w-full">
          <p className="font-display text-xs tracking-widest text-primary">BRAIN · LLM REASONING</p>
          <p className="text-[10px] text-muted-foreground font-mono">Claude / z-ai-web-dev-sdk · personality prompt + router + synthesizer</p>
        </div>
      </div>

      <Connector />

      {/* Memory + Research layer */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <TierBox label="T1 · SENSORY" sub="volatile · 8 entries" />
        <TierBox label="T2 · SHORT-TERM" sub="24 turns · decay" />
        <TierBox label="T3 · EPISODIC" sub="vector log · cosine recall" />
        <TierBox label="T4 · SEMANTIC" sub="knowledge graph" />
        <TierBox label="RESEARCH" sub="web_search + page_reader" highlight />
      </div>

      <Connector />

      {/* Voice layer */}
      <div className="flex justify-center">
        <div className="rounded border border-primary/40 bg-primary/5 px-5 py-2 text-center">
          <p className="font-display text-xs tracking-widest text-primary">VOICE · ELEVENLABS TTS</p>
          <p className="text-[10px] text-muted-foreground font-mono">Paul Bettany timbre · fallback to z-ai TTS</p>
        </div>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-6 bg-gradient-to-b from-primary/60 to-primary/20" />
    </div>
  )
}

function TierBox({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 text-center ${highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-primary/30 bg-primary/5'}`}>
      <p className={`font-mono text-[10px] tracking-wider ${highlight ? 'text-amber-500/90' : 'text-primary/90'}`}>{label}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}
