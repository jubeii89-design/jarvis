'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FolderTree, FileText, Brain, Link2, Stethoscope, Play,
  Loader2, CheckCircle2, AlertTriangle, Plus, RefreshCw, BookOpen
} from 'lucide-react'

interface SecondBrainStatus {
  rawFiles: number
  rawByType: Record<string, number>
  wikiPages: number
  wikiByType: Record<string, number>
  compiledPages: number
  stubPages: number
  orphanPages: number
  lastCompiledAt: string | null
  totalWords: number
  lintSummary: { gaps: number; stale: number; brokenLinks: number; orphans: number; generatedAt: string } | null
}

interface WikiPageSummary {
  slug: string
  title: string
  type: string
  tags: string[]
  related: string[]
  compiled: boolean
  compiledAt: string | null
  compiledBy: string | null
  wordCount: number
  relativePath: string
}

interface OperationResult {
  ok?: boolean
  message?: string
  error?: string
  detail?: string
  ingested?: any[]
  compiled?: any[]
  skipped?: any[]
  errors?: any[]
  summary?: any
  details?: any
}

export function SecondBrainPanel() {
  const [status, setStatus] = useState<SecondBrainStatus | null>(null)
  const [pages, setPages] = useState<WikiPageSummary[]>([])
  const [selectedPage, setSelectedPage] = useState<WikiPageSummary | null>(null)
  const [pageContent, setPageContent] = useState<string>('')
  const [running, setRunning] = useState<string | null>(null) // 'ingest' | 'compile' | 'link' | 'lint'
  const [result, setResult] = useState<OperationResult | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addType, setAddType] = useState<'note' | 'article' | 'transcript'>('note')

  const refresh = useCallback(async () => {
    try {
      const [statusResp, pagesResp] = await Promise.all([
        fetch('/api/jarvis/second-brain').then(r => r.json()),
        fetch('/api/jarvis/second-brain/wiki').then(r => r.json())
      ])
      setStatus(statusResp)
      setPages(pagesResp.pages ?? [])
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10000)
    return () => clearInterval(id)
  }, [refresh])

  const runOperation = async (op: 'ingest' | 'compile' | 'link' | 'lint') => {
    setRunning(op)
    setResult(null)
    try {
      const body = op === 'compile' ? { maxPages: 5 } : {}
      const resp = await fetch(`/api/jarvis/second-brain/${op}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data: OperationResult = await resp.json()
      setResult(data)
      await refresh()
    } catch (err) {
      setResult({ error: 'Request failed', detail: err instanceof Error ? err.message : String(err) })
    } finally {
      setRunning(null)
    }
  }

  const addRaw = async () => {
    if (!addTitle.trim() || !addContent.trim()) return
    setRunning('add')
    try {
      const resp = await fetch('/api/jarvis/second-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: addType, title: addTitle, content: addContent })
      })
      const data = await resp.json()
      setResult(data)
      setAddTitle('')
      setAddContent('')
      await refresh()
    } finally {
      setRunning(null)
    }
  }

  const viewPage = async (p: WikiPageSummary) => {
    setSelectedPage(p)
    try {
      const resp = await fetch(`/api/jarvis/second-brain/wiki?slug=${p.slug}`)
      const data = await resp.json()
      setPageContent(data.body ?? '*(empty)*')
    } catch {
      setPageContent('Failed to load page.')
    }
  }

  return (
    <div className="h-full overflow-y-auto jarvis-scroll">
      <div className="p-5 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl text-glow-soft text-primary">Second Brain</h2>
            <p className="text-sm text-muted-foreground mt-1">Karpathy-style compiled knowledge base · Tier 5 memory</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="border-primary/40 text-primary hover:bg-primary/10">
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
          </Button>
        </div>

        {/* Status dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText} label="Raw Files" value={status?.rawFiles ?? 0} sublabel="awaiting ingest" color="amber" />
          <StatCard icon={BookOpen} label="Wiki Pages" value={status?.wikiPages ?? 0} sublabel={`${status?.compiledPages ?? 0} compiled · ${status?.stubPages ?? 0} stubs`} color="cyan" />
          <StatCard icon={Brain} label="Total Words" value={(status?.totalWords ?? 0).toLocaleString()} sublabel="compiled knowledge" color="cyan" />
          <StatCard icon={AlertTriangle} label="Lint Issues" value={
            status?.lintSummary
              ? (status.lintSummary.gaps + status.lintSummary.stale + status.lintSummary.brokenLinks + status.lintSummary.orphans)
              : 0
          } sublabel="gaps + stale + broken + orphans" color="amber" />
        </div>

        {/* Operations */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <p className="font-display text-sm text-primary">Compilation Pipeline</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The four operations run in sequence during normal use: <b>Ingest</b> reads RAW files and creates wiki stubs,
              <b> Compile</b> enriches stubs with synthesis from the brain, <b>Link</b> builds cross-references and MOCs,
              <b> Lint</b> identifies gaps, stale pages, and orphans.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <OpButton op="ingest" icon={FolderTree} label="Ingest" running={running} onClick={() => runOperation('ingest')} />
              <OpButton op="compile" icon={Brain} label="Compile" running={running} onClick={() => runOperation('compile')} />
              <OpButton op="link" icon={Link2} label="Link" running={running} onClick={() => runOperation('link')} />
              <OpButton op="lint" icon={Stethoscope} label="Lint" running={running} onClick={() => runOperation('lint')} />
            </div>
            {result && (
              <div className={`rounded border p-3 text-xs ${result.error ? 'border-destructive/40 bg-destructive/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
                <p className={`font-mono text-[10px] tracking-widest mb-1 ${result.error ? 'text-destructive' : 'text-emerald-400'}`}>
                  {result.error ? '[ERROR]' : '[OK]'}
                </p>
                <p className="text-foreground/90">{result.error ?? result.message}</p>
                {result.ingested && result.ingested.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground">INGESTED:</p>
                    {result.ingested.map((r, i) => (
                      <p key={i} className="text-[11px] text-foreground/70 font-mono">→ {r.wikiPage} ({r.title})</p>
                    ))}
                  </div>
                )}
                {result.compiled && result.compiled.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground">COMPILED:</p>
                    {result.compiled.map((r, i) => (
                      <p key={i} className="text-[11px] text-foreground/70 font-mono">→ {r.slug} ({r.title})</p>
                    ))}
                  </div>
                )}
                {result.summary && (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-mono text-foreground/70">
                    <span>Gaps: {result.summary.gaps}</span>
                    <span>Stale: {result.summary.stale}</span>
                    <span>Broken: {result.summary.brokenLinks}</span>
                    <span>Orphans: {result.summary.orphans}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Add raw content */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <p className="font-display text-sm text-primary">Add Raw Content</p>
            <p className="text-xs text-muted-foreground">Drop a note, article, or transcript into RAW/. It will be ingested into a wiki stub on the next ingest operation.</p>
            <div className="flex gap-2 flex-wrap">
              {(['note', 'article', 'transcript'] as const).map(t => (
                <Button
                  key={t}
                  variant={addType === t ? 'default' : 'outline'}
                  size="sm"
                  className={addType === t ? 'bg-primary/90 text-primary-foreground' : 'border-primary/30 text-muted-foreground'}
                  onClick={() => setAddType(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
            <input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Title..."
              className="w-full bg-background/60 border border-primary/30 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/60"
            />
            <Textarea
              value={addContent}
              onChange={(e) => setAddContent(e.target.value)}
              placeholder="Content (markdown)..."
              className="min-h-[100px] bg-background/60 border-primary/30 font-mono text-xs"
            />
            <Button
              onClick={addRaw}
              disabled={!addTitle.trim() || !addContent.trim() || running === 'add'}
              size="sm"
              className="bg-primary/90 hover:bg-primary text-primary-foreground"
            >
              {running === 'add' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
              Add to RAW
            </Button>
          </div>
        </Card>

        {/* Wiki pages list + viewer */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-card/40 border-primary/25 hud-corner">
            <div className="p-4">
              <p className="font-display text-sm text-primary mb-3">Wiki Pages ({pages.length})</p>
              <ScrollArea className="max-h-96 jarvis-scroll">
                <div className="space-y-1">
                  {pages.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 italic py-4 text-center">No wiki pages yet. Add raw content and run Ingest.</p>
                  ) : (
                    pages.map(p => (
                      <button
                        key={p.slug}
                        onClick={() => viewPage(p)}
                        className={`w-full text-left rounded border p-2 transition-colors ${
                          selectedPage?.slug === p.slug
                            ? 'border-primary/60 bg-primary/10'
                            : 'border-border/40 bg-background/40 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-foreground/90 truncate">{p.title}</span>
                          {p.compiled ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[8px] font-mono border-border/40 text-muted-foreground">{p.type}</Badge>
                          <span className="text-[9px] text-muted-foreground/70 font-mono">{p.wordCount} words</span>
                          <span className="text-[9px] text-muted-foreground/70 font-mono">
                            {p.compiled ? 'compiled' : 'stub'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>

          <Card className="bg-card/40 border-primary/25 hud-corner">
            <div className="p-4">
              <p className="font-display text-sm text-primary mb-3">
                {selectedPage ? selectedPage.title : 'Page Viewer'}
              </p>
              {selectedPage ? (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {selectedPage.tags.map(t => (
                      <Badge key={t} variant="outline" className="text-[9px] font-mono border-primary/30 text-primary/60">#{t}</Badge>
                    ))}
                  </div>
                  <ScrollArea className="max-h-80 jarvis-scroll">
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">{pageContent}</pre>
                  </ScrollArea>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic py-8 text-center">Select a page to view its content.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Lint reports */}
        {status?.lintSummary && (
          <Card className="bg-card/40 border-primary/25 hud-corner">
            <div className="p-4">
              <p className="font-display text-sm text-primary mb-3">Lint Report</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <LintStat label="Gaps" value={status.lintSummary.gaps} hint="red links — pages to write" />
                <LintStat label="Stale" value={status.lintSummary.stale} hint="pages older than 30 days" />
                <LintStat label="Broken Links" value={status.lintSummary.brokenLinks} hint="wikilinks to nowhere" />
                <LintStat label="Orphans" value={status.lintSummary.orphans} hint="pages with no inbound links" />
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-3">
                Generated: {new Date(status.lintSummary.generatedAt).toLocaleString()}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sublabel, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sublabel: string
  color: 'cyan' | 'amber'
}) {
  return (
    <Card className={`hud-corner ${color === 'cyan' ? 'bg-primary/5 border-primary/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-3.5 w-3.5 ${color === 'cyan' ? 'text-primary' : 'text-amber-500'}`} />
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
        </div>
        <p className={`font-display text-2xl ${color === 'cyan' ? 'text-primary' : 'text-amber-500'}`}>{value}</p>
        <p className="text-[9px] text-muted-foreground/70 font-mono mt-0.5">{sublabel}</p>
      </div>
    </Card>
  )
}

function OpButton({ op, icon: Icon, label, running, onClick }: {
  op: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  running: string | null
  onClick: () => void
}) {
  const isRunning = running === op
  return (
    <Button
      onClick={onClick}
      disabled={running !== null}
      variant="outline"
      size="sm"
      className="border-primary/40 text-primary hover:bg-primary/10 h-auto py-2"
    >
      {isRunning ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Icon className="h-3.5 w-3.5 mr-2" />}
      {label}
    </Button>
  )
}

function LintStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-2">
      <p className="text-[10px] font-mono text-muted-foreground">{label.toUpperCase()}</p>
      <p className={`font-display text-xl mt-0.5 ${value > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground/70 mt-0.5">{hint}</p>
    </div>
  )
}
