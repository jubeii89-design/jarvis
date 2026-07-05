'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Brain, Clock, Database, Network, Activity } from 'lucide-react'

interface MemorySnapshot {
  sessionId: string
  tiers: {
    sensory: { label: string; description: string; capacity: number; entries: any[] }
    shortTerm: { label: string; description: string; capacity: number; entries: any[] }
    episodic: { label: string; description: string; entries: any[] }
    semantic: { label: string; description: string; nodes: any[]; edges: any[] }
  }
  research: any[]
}

export function MemoryPanel({ sessionId }: { sessionId: string | null }) {
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const url = sessionId ? `/api/jarvis/memory?sessionId=${sessionId}` : '/api/jarvis/memory'
      const r = await fetch(url)
      const d = await r.json()
      setSnapshot(d)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 5000) // refresh every 5s
    return () => clearInterval(id)
  }, [sessionId])

  if (loading && !snapshot) {
    return <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading memory state...</div>
  }
  if (!snapshot) {
    return <div className="p-8 text-center text-destructive font-mono text-sm">Failed to load memory.</div>
  }

  const { tiers } = snapshot

  return (
    <div className="h-full overflow-y-auto jarvis-scroll">
      <div className="p-5 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl text-glow-soft text-primary">4-Tier Memory State</h2>
            <p className="text-[10px] text-muted-foreground font-mono">SESSION: {snapshot.sessionId}</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="border-primary/40 text-primary hover:bg-primary/10">
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
          </Button>
        </div>

        {/* Tier 1: Sensory */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <TierHeader
            icon={Activity}
            label={tiers.sensory.label}
            description={tiers.sensory.description}
            badges={[`${tiers.sensory.entries.length}/${tiers.sensory.capacity} entries`]}
            tierColor="cyan"
          />
          <div className="px-4 pb-4 space-y-1.5">
            {tiers.sensory.entries.length === 0 ? (
              <EmptyHint label="No sensory input yet" />
            ) : (
              tiers.sensory.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-primary/60">{new Date(e.ts).toLocaleTimeString()}</span>
                  <Badge variant="outline" className="text-[9px] border-primary/40 text-primary/70">{e.modality}</Badge>
                  <span className="text-foreground/70 truncate">{e.raw}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Tier 2: Short-Term */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <TierHeader
            icon={Clock}
            label={tiers.shortTerm.label}
            description={tiers.shortTerm.description}
            badges={[`${tiers.shortTerm.entries.length}/${tiers.shortTerm.capacity} turns`]}
            tierColor="cyan"
          />
          <ScrollArea className="max-h-72 jarvis-scroll">
            <div className="px-4 pb-4 space-y-1.5">
              {tiers.shortTerm.entries.length === 0 ? (
                <EmptyHint label="No conversation yet" />
              ) : (
                tiers.shortTerm.entries.map((m, i) => (
                  <div key={i} className="rounded border border-border/40 bg-background/40 p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[9px] font-mono ${
                        m.role === 'user' ? 'border-blue-400/40 text-blue-400' :
                        m.role === 'assistant' ? 'border-primary/40 text-primary' :
                        m.role === 'tool' ? 'border-amber-500/40 text-amber-500' :
                        'border-border text-muted-foreground'
                      }`}>{m.role.toUpperCase()}</Badge>
                    </div>
                    <p className="text-foreground/70 line-clamp-3">{m.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Tier 3: Episodic */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <TierHeader
            icon={Database}
            label={tiers.episodic.label}
            description={tiers.episodic.description}
            badges={[`${tiers.episodic.entries.length} episodes`]}
            tierColor="cyan"
          />
          <ScrollArea className="max-h-72 jarvis-scroll">
            <div className="px-4 pb-4 space-y-1.5">
              {tiers.episodic.entries.length === 0 ? (
                <EmptyHint label="No episodes recorded yet" />
              ) : (
                tiers.episodic.entries.map((e, i) => (
                  <div key={i} className="rounded border border-border/40 bg-background/40 p-2">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <div className="flex gap-1.5">
                        {(e.tags ?? []).map((t: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[9px] border-primary/30 text-primary/60">#{t}</Badge>
                        ))}
                      </div>
                      <Badge variant="outline" className="text-[9px] border-border/40 text-muted-foreground">
                        importance {(e.importance * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/70 line-clamp-3 whitespace-pre-wrap">{e.text}</p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono mt-1">
                      created {new Date(e.createdAt).toLocaleString()} · last recalled {e.lastRecalled ? new Date(e.lastRecalled).toLocaleString() : 'never'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Tier 4: Semantic */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <TierHeader
            icon={Network}
            label={tiers.semantic.label}
            description={tiers.semantic.description}
            badges={[`${tiers.semantic.nodes.length} nodes`, `${tiers.semantic.edges.length} edges`]}
            tierColor="cyan"
          />
          <div className="px-4 pb-4">
            {tiers.semantic.nodes.length === 0 ? (
              <EmptyHint label="Knowledge graph is empty" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-3">
                  {tiers.semantic.nodes.slice(0, 24).map((n) => (
                    <div key={n.id} className="rounded border border-border/40 bg-background/40 p-2">
                      <p className="text-xs font-mono text-primary truncate">{n.name}</p>
                      <p className="text-[9px] text-muted-foreground">{n.type}</p>
                    </div>
                  ))}
                </div>
                {tiers.semantic.edges.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono tracking-widest text-muted-foreground">RELATIONS</p>
                    {tiers.semantic.edges.slice(0, 12).map((e, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground/70 flex items-center gap-1.5 flex-wrap">
                        <span className="text-primary">{e.source}</span>
                        <span className="text-muted-foreground">—{e.predicate}→</span>
                        <span className="text-primary">{e.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Research log */}
        {snapshot.research.length > 0 && (
          <Card className="bg-card/40 border-primary/25 hud-corner">
            <TierHeader
              icon={Brain}
              label="Research Log"
              description="Audit trail of every web research operation JARVIS has performed."
              badges={[`${snapshot.research.length} queries`]}
              tierColor="amber"
            />
            <div className="px-4 pb-4 space-y-1.5">
              {snapshot.research.map((r, i) => (
                <div key={i} className="rounded border border-border/40 bg-background/40 p-2 text-xs">
                  <p className="font-mono text-primary/80">{r.query}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {r.resultCount} results · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function TierHeader({ icon: Icon, label, description, badges, tierColor }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  badges: string[]
  tierColor: 'cyan' | 'amber'
}) {
  return (
    <div className="flex items-start gap-3 p-4 pb-3 border-b border-border/30">
      <div className={`flex-shrink-0 w-9 h-9 rounded border flex items-center justify-center ${
        tierColor === 'cyan' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-display text-sm text-primary">{label}</p>
          <div className="flex gap-1.5">
            {badges.map((b, i) => (
              <Badge key={i} variant="outline" className={`text-[9px] font-mono ${
                tierColor === 'cyan' ? 'border-primary/40 text-primary/70' : 'border-amber-500/40 text-amber-500/70'
              }`}>{b}</Badge>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground/60 italic py-2 text-center font-mono">{label}</p>
}
