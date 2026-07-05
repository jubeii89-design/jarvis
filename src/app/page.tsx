'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChatPanel } from '@/components/jarvis/chat-panel'
import { BlueprintPanel } from '@/components/jarvis/blueprint-panel'
import { MemoryPanel } from '@/components/jarvis/memory-panel'
import { VoiceSetupPanel } from '@/components/jarvis/voice-setup-panel'
import { ClaudeCodePanel } from '@/components/jarvis/claude-code-panel'
import { SecondBrainPanel } from '@/components/jarvis/second-brain-panel'
import { ArcReactor } from '@/components/jarvis/arc-reactor'
import { useJarvisStore } from '@/lib/jarvis/store'
import { MessageSquare, Cpu, Brain, Mic, Code2, Activity, BookOpen } from 'lucide-react'

type TabId = 'chat' | 'blueprint' | 'memory' | 'voice' | 'claude' | 'second-brain'

export default function Home() {
  const [tab, setTab] = useState<TabId>('chat')
  const { sessionId, setVoiceConfig, setBrainConfig, brainConfig } = useJarvisStore()

  // Fetch voice + brain config on mount
  useEffect(() => {
    fetch('/api/jarvis/voice')
      .then(r => r.json())
      .then(d => setVoiceConfig(d))
      .catch(() => {})
    fetch('/api/jarvis/brain')
      .then(r => r.json())
      .then(d => setBrainConfig(d))
      .catch(() => {})
  }, [setVoiceConfig, setBrainConfig])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top status bar */}
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ArcReactor size={36} />
            <div>
              <p className="font-display text-sm tracking-[0.2em] text-primary text-glow-cyan">J.A.R.V.I.S.</p>
              <p className="text-[9px] text-muted-foreground font-mono tracking-widest">JUST A RATHER VERY INTELLIGENT SYSTEM</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <StatusIndicator
              label="BRAIN"
              status={brainConfig?.anthropicConfigured ? 'claude' : 'fallback'}
              detail={brainConfig?.label}
            />
            <StatusIndicator label="MEMORY" status="active" />
            <StatusIndicator label="VOICE" status="standby" />
            <StatusIndicator label="RESEARCH" status="ready" />
            {sessionId && (
              <span className="text-primary/60">SESSION: {sessionId.slice(-8)}</span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex-1 flex flex-col overflow-hidden">
          {/* Tab list — sidebar on desktop, top on mobile */}
          <div className="border-b border-border/40 bg-card/20">
            <TabsList className="h-auto bg-transparent p-2 grid grid-cols-3 md:grid-cols-6 gap-1 w-full max-w-4xl mx-auto">
              <TabTrigger value="chat" icon={MessageSquare} label="Chat" />
              <TabTrigger value="second-brain" icon={BookOpen} label="Second Brain" />
              <TabTrigger value="blueprint" icon={Cpu} label="Blueprint" />
              <TabTrigger value="memory" icon={Brain} label="Memory" />
              <TabTrigger value="voice" icon={Mic} label="Voice" />
              <TabTrigger value="claude" icon={Code2} label="Claude Code" />
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <ChatPanel />
          </TabsContent>
          <TabsContent value="second-brain" className="flex-1 m-0 overflow-hidden data-[state=active]:block">
            <SecondBrainPanel />
          </TabsContent>
          <TabsContent value="blueprint" className="flex-1 m-0 overflow-hidden data-[state=active]:block">
            <BlueprintPanel />
          </TabsContent>
          <TabsContent value="memory" className="flex-1 m-0 overflow-hidden data-[state=active]:block">
            <MemoryPanel sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="voice" className="flex-1 m-0 overflow-hidden data-[state=active]:block">
            <VoiceSetupPanel />
          </TabsContent>
          <TabsContent value="claude" className="flex-1 m-0 overflow-hidden data-[state=active]:block">
            <ClaudeCodePanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 py-2 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
          <span>J.A.R.V.I.S. v1.0.0 · Stark Industries</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5 text-primary/60" /> 4-tier memory online</span>
            <span>·</span>
            <span>Powered by Claude-class LLM + ElevenLabs TTS</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

function TabTrigger({ value, icon: Icon, label }: {
  value: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex-col gap-1 h-auto py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground font-display text-[11px] tracking-wider"
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  )
}

function StatusIndicator({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const color =
    status === 'claude' ? 'bg-emerald-400' :
    status === 'online' ? 'bg-emerald-400' :
    status === 'active' ? 'bg-primary' :
    status === 'standby' ? 'bg-amber-500' :
    status === 'fallback' ? 'bg-amber-500' :
    'bg-primary/60'
  const statusText = detail ?? status
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
      <span className="tracking-widest">{label}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-foreground/70">{statusText}</span>
    </span>
  )
}
