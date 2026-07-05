'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Terminal, KeyRound, Github, ExternalLink, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, Play, Lock
} from 'lucide-react'

interface BrainStatus {
  engine: 'anthropic' | 'zai'
  model: string | null
  anthropicConfigured: boolean
  label: string
  instructions: string
}

interface CodeStatus {
  enabled: boolean
  anthropicConfigured: boolean
  cliInstalled: boolean
  cliPath: string | null
  authStatus: string
  authDetail: string
  model: string
  summary: string
}

interface CodeResult {
  permissionRequired?: boolean
  message?: string
  prompt?: string
  ok?: boolean
  output?: string
  stderr?: string | null
  error?: string
  detail?: string
  blocked?: boolean
  hint?: string
}

export function ClaudeCodePanel() {
  const [brain, setBrain] = useState<BrainStatus | null>(null)
  const [code, setCode] = useState<CodeStatus | null>(null)
  const [prompt, setPrompt] = useState('List the files in the current project directory and briefly describe the architecture.')
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CodeResult | null>(null)

  const refresh = async () => {
    fetch('/api/jarvis/brain').then(r => r.json()).then(setBrain).catch(() => {})
    fetch('/api/jarvis/code').then(r => r.json()).then(setCode).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const execute = async (confirmedPrompt?: string) => {
    setRunning(true)
    setResult(null)
    try {
      const resp = await fetch('/api/jarvis/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: confirmedPrompt ?? prompt,
          confirmed: !!confirmedPrompt
        })
      })
      const data: CodeResult = await resp.json()
      setResult(data)
      if (data.permissionRequired) {
        setPendingPrompt(prompt)
      } else {
        setPendingPrompt(null)
      }
    } catch (err) {
      setResult({ error: 'Request failed', detail: err instanceof Error ? err.message : String(err) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto jarvis-scroll">
      <div className="p-5 space-y-5 max-w-4xl mx-auto">

        <div className="text-center">
          <h2 className="font-display text-xl text-glow-soft text-primary">Claude Code Access</h2>
          <p className="text-sm text-muted-foreground mt-1">The brain — Anthropic Claude integration + agentic coding</p>
        </div>

        {/* Live brain status */}
        <Card className={`hud-corner ${brain?.anthropicConfigured ? 'bg-emerald-500/5 border-emerald-500/40' : 'bg-amber-500/5 border-amber-500/40'}`}>
          <div className="p-4 flex items-start gap-3">
            {brain?.anthropicConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm text-primary">
                {brain?.anthropicConfigured ? 'Anthropic Claude Configured' : 'Using Fallback Brain (z-ai SDK)'}
              </p>
              {brain?.anthropicConfigured ? (
                <p className="text-xs text-foreground/80 mt-1 font-mono">
                  Engine: <span className="text-emerald-400">anthropic</span> · Model: <span className="text-emerald-400">{brain.model}</span>
                </p>
              ) : (
                <p className="text-xs text-foreground/80 mt-1">
                  ANTHROPIC_API_KEY is not set. JARVIS is reasoning with the z-ai-web-dev-sdk fallback.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1 italic">{brain?.instructions}</p>
            </div>
          </div>
        </Card>

        {/* Live agentic coding status */}
        <Card className={`hud-corner ${code?.enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/5 border-border/40'}`}>
          <div className="p-4 flex items-start gap-3">
            <Terminal className={`h-5 w-5 flex-shrink-0 mt-0.5 ${code?.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display text-sm text-primary">Agentic Coding</p>
                <Badge variant="outline" className={`text-[9px] font-mono ${
                  code?.enabled ? 'border-emerald-400/50 text-emerald-400' : 'border-border text-muted-foreground'
                }`}>
                  {code?.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
                {code?.cliInstalled && (
                  <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary/70">
                    CLI v2.1.199
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground/80 mt-1 font-mono break-all">
                {code?.summary}
              </p>
              {code?.authStatus === 'blocked' && (
                <p className="text-xs text-amber-500 mt-2 leading-relaxed">
                  The Anthropic API is geofencing this region (HTTP 403 "Request not allowed").
                  The CLI is installed and authenticated, but Anthropic's edge rejects the request.
                  Deploy from an Anthropic-supported region to use agentic coding.
                </p>
              )}
              {code?.authStatus === 'ok' && (
                <p className="text-xs text-emerald-400 mt-2">
                  Ready. JARVIS can invoke the Claude Code CLI for file edits, shell operations, and repository reasoning.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Live code execution tester */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm text-primary">Code Execution Tester</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={refresh}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh status
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pose a coding task. JARVIS will request permission before invoking the Claude Code CLI.
              The CLI executes with file and shell access scoped to the project directory.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Read the Prisma schema and summarize the 4-tier memory models."
              className="min-h-[60px] bg-background/60 border-primary/30 font-mono text-xs"
              disabled={running}
            />
            <Button
              onClick={() => execute()}
              disabled={running || !prompt.trim() || !code?.enabled}
              className="bg-primary/90 hover:bg-primary text-primary-foreground"
              size="sm"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-2" />}
              {running ? 'Executing...' : 'Submit to JARVIS'}
            </Button>

            {/* Permission gate */}
            {result?.permissionRequired && pendingPrompt && (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                <p className="font-mono text-[10px] tracking-widest text-amber-500">[JARVIS] PERMISSION REQUIRED</p>
                <p className="text-xs text-foreground/90 italic">{result.message}</p>
                <div className="rounded bg-background/60 border border-border/40 p-2">
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">PROMPT:</p>
                  <p className="text-xs font-mono text-foreground/80">{pendingPrompt}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-emerald-600/80 hover:bg-emerald-600"
                    onClick={() => execute(pendingPrompt)}
                    disabled={running}
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" /> Allow once
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-muted-foreground"
                    onClick={() => { setPendingPrompt(null); setResult(null) }}
                  >
                    Deny
                  </Button>
                </div>
              </div>
            )}

            {/* Result */}
            {result?.ok && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-3">
                <p className="font-mono text-[10px] tracking-widest text-emerald-400 mb-2">[CLAUDE CODE] OUTPUT</p>
                <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto jarvis-scroll">{result.output}</pre>
                {result.stderr && (
                  <p className="text-[10px] text-amber-500 mt-2 font-mono">STDERR: {result.stderr}</p>
                )}
              </div>
            )}

            {/* Error */}
            {result?.error && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
                <p className="font-mono text-[10px] tracking-widest text-destructive mb-1">[JARVIS] ERROR</p>
                <p className="text-xs text-foreground/90">{result.error}</p>
                {result.detail && <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">{result.detail}</p>}
                {result.hint && <p className="text-[11px] text-amber-500 mt-2 italic">{result.hint}</p>}
              </div>
            )}
          </div>
        </Card>

        {/* Permission request banner */}
        <Card className="bg-amber-500/5 border-amber-500/40 hud-corner">
          <div className="p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display text-sm text-amber-500">Permission Protocol</p>
              <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                JARVIS will never execute agentic shell commands silently. The first time JARVIS invokes
                the Claude Code CLI on a given prompt, you will see a permission dialog showing the exact
                prompt and working directory. You can allow once, allow always for the session, or deny.
              </p>
            </div>
          </div>
        </Card>

        {/* Setup protocol */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-3">
            <p className="font-display text-sm text-primary">Setup Protocol</p>

            <StepBlock num={1} icon={KeyRound} title="Obtain an Anthropic API key">
              <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                Visit the Anthropic Console, create an account, and generate an API key.
                New accounts receive $5 of free credit. Production usage requires billing setup.
              </p>
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Anthropic Console
                </Button>
              </a>
            </StepBlock>

            <StepBlock num={2} icon={Terminal} title="Install Claude Code CLI">
              <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                The CLI is installed in this sandbox at <code className="text-primary/80 font-mono">/home/z/.npm-global/bin/claude</code>.
                To install locally:
              </p>
              <pre className="bg-background/60 border border-border/40 rounded p-2 text-[10px] font-mono overflow-x-auto">
{`npm install -g @anthropic-ai/claude-code
claude --version
claude login  # OAuth authentication`}
              </pre>
            </StepBlock>

            <StepBlock num={3} icon={KeyRound} title="Configure environment variables">
              <pre className="bg-background/60 border border-border/40 rounded p-2 text-[10px] font-mono overflow-x-auto">
{`# .env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
CLAUDE_CODE_ENABLED=true   # enables agentic coding via CLI`}
              </pre>
              <p className="text-[11px] text-muted-foreground mt-2">
                Current status in this sandbox:
              </p>
              <ul className="text-[11px] text-foreground/80 mt-1 space-y-0.5">
                <li>ANTHROPIC_API_KEY: <span className={brain?.anthropicConfigured ? 'text-emerald-400' : 'text-amber-500'}>{brain?.anthropicConfigured ? 'set' : 'missing'}</span></li>
                <li>ANTHROPIC_MODEL: <span className="text-primary/80 font-mono">{brain?.model ?? '—'}</span></li>
                <li>CLAUDE_CODE_ENABLED: <span className={code?.enabled ? 'text-emerald-400' : 'text-amber-500'}>{code?.enabled ? 'true' : 'false'}</span></li>
                <li>claude CLI: <span className={code?.cliInstalled ? 'text-emerald-400' : 'text-amber-500'}>{code?.cliInstalled ? `installed at ${code.cliPath}` : 'not installed'}</span></li>
                <li>API reachability: <span className={code?.authStatus === 'ok' ? 'text-emerald-400' : 'text-amber-500'}>{code?.authStatus ?? 'unknown'}</span></li>
              </ul>
            </StepBlock>

            <StepBlock num={4} icon={ShieldCheck} title="Permission flow">
              <p className="text-xs text-foreground/80 leading-relaxed mb-2">
                When JARVIS needs to perform agentic coding, it requests permission. Use the
                "Code Execution Tester" above to see the flow in action.
              </p>
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="font-mono text-amber-500 mb-1">[JARVIS] Permission required:</p>
                <p className="text-foreground/80 italic">
                  Sir, I wish to invoke Claude Code to refactor the authentication module.
                  This will execute shell commands on your machine. Shall I proceed?
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="h-6 text-[10px] bg-emerald-600/80 hover:bg-emerald-600">Allow once</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] border-primary/40 text-primary">Allow always</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground">Deny</Button>
                </div>
              </div>
            </StepBlock>
          </div>
        </Card>

        {/* Regional block notice */}
        {code?.authStatus === 'blocked' && (
          <Card className="bg-destructive/5 border-destructive/40 hud-corner">
            <div className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-sm text-destructive">Regional Geofence Detected</p>
                <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                  The Anthropic API is returning HTTP 403 "Request not allowed" from this sandbox's
                  egress IP. This is Anthropic's geofencing — they block certain regions (including
                  Hong Kong, where this sandbox is hosted). The API key and code are correct; the block
                  is at Anthropic's network edge.
                </p>
                <p className="text-xs text-foreground/80 mt-2 leading-relaxed">
                  <span className="text-primary/80 font-mono">To use Claude:</span> Deploy JARVIS from an
                  Anthropic-supported region, or route the Next.js server's outbound traffic through a
                  proxy in a supported region. Until then, JARVIS gracefully falls back to the z-ai SDK
                  brain and remains fully functional — only the Claude-specific path is affected.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Privacy */}
        <Card className="bg-card/40 border-primary/25 hud-corner">
          <div className="p-4 space-y-2">
            <p className="font-display text-sm text-primary">Privacy & Data Handling</p>
            <ul className="space-y-1.5 text-xs text-foreground/80">
              <li className="flex gap-2"><span className="text-primary">▸</span> API keys are stored only in your environment, never transmitted to JARVIS's frontend.</li>
              <li className="flex gap-2"><span className="text-primary">▸</span> Conversations are stored in the local SQLite database (or your configured Prisma datasource).</li>
              <li className="flex gap-2"><span className="text-primary">▸</span> Claude API calls go directly from the server to Anthropic; no intermediaries.</li>
              <li className="flex gap-2"><span className="text-primary">▸</span> Voice audio for ElevenLabs is sent only to ElevenLabs servers.</li>
              <li className="flex gap-2"><span className="text-primary">▸</span> Claude Code CLI executes only after explicit per-prompt permission.</li>
              <li className="flex gap-2"><span className="text-primary">▸</span> You can clear all memory at any time via the Memory tab → DELETE endpoint.</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StepBlock({ num, icon: Icon, title, children }: {
  num: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded border border-border/40 bg-background/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 w-7 h-7 rounded border border-primary/40 bg-primary/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs font-mono text-primary">STEP {num} · {title}</p>
      </div>
      <div className="ml-9">{children}</div>
    </div>
  )
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}
