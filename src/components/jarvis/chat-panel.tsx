'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useJarvisStore, type ChatMessage } from '@/lib/jarvis/store'
import { ArcReactor } from './arc-reactor'
import { VoiceWaveform } from './voice-waveform'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Mic, Volume2, Square, Search, Loader2, Trash2 } from 'lucide-react'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const {
    sessionId, messages, thinking, speaking, voiceConfig,
    setSessionId, addMessage, setThinking, setSpeaking, clearMessages
  } = useJarvisStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const send = useCallback(async () => {
    if (!input.trim() || thinking) return
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }
    addMessage(userMsg)
    const sentText = input.trim()
    setInput('')
    setThinking(true)

    try {
      const resp = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: sentText, sessionId })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (data.sessionId && !sessionId) setSessionId(data.sessionId)
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        diagnostics: data.diagnostics
      })
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `I am afraid I encountered a difficulty, sir. ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now()
      })
    } finally {
      setThinking(false)
    }
  }, [input, thinking, sessionId, addMessage, setThinking, setSessionId])

  const speak = useCallback(async (text: string) => {
    if (speaking) {
      // stop
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    try {
      const resp = await fetch('/api/jarvis/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
      }
      await audio.play()
    } catch (err) {
      console.error('Voice error:', err)
      setSpeaking(false)
    }
  }, [speaking, setSpeaking])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-display text-sm tracking-widest text-primary/90">J.A.R.V.I.S. ONLINE</span>
        </div>
        <div className="flex items-center gap-2">
          {voiceConfig && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary/80">
              {voiceConfig.elevenlabsConfigured ? 'ELEVENLABS' : 'FALLBACK TTS'}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => { clearMessages(); setSessionId(null) }}
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 jarvis-scroll">
        <div className="p-4 space-y-4 min-h-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <ArcReactor size={140} />
              <p className="mt-6 font-display text-lg text-glow-cyan text-primary">
                At your service, sir.
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                J.A.R.V.I.S. is online. Pose any question, or request web research.
                The four-tier memory is active; episodes will be recalled as you converse.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onSpeak={speak} speaking={speaking} />
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-mono">JARVIS is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Voice waveform (when speaking) */}
      {speaking && (
        <div className="px-4 py-2 border-t border-border/40 bg-card/30">
          <VoiceWaveform active={speaking} engine={voiceConfig?.elevenlabsConfigured ? 'elevenlabs' : 'fallback'} />
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border/40 bg-card/20">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Address JARVIS..."
            className="min-h-[44px] max-h-32 resize-none bg-background/60 border-primary/30 focus-visible:ring-primary/40 font-mono text-sm"
            disabled={thinking}
          />
          <Button
            onClick={send}
            disabled={!input.trim() || thinking}
            className="bg-primary/90 hover:bg-primary text-primary-foreground box-glow-cyan"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/70 font-mono">
          ENTER to send · SHIFT+ENTER for newline
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message, onSpeak, speaking }: {
  message: ChatMessage
  onSpeak: (text: string) => void
  speaking: boolean
}) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? '' : 'w-full'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-mono tracking-wider ${isUser ? 'text-muted-foreground' : 'text-primary/80'}`}>
            {isUser ? 'YOU' : 'J.A.R.V.I.S.'}
          </span>
          {!isUser && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
              onClick={() => onSpeak(message.content)}
              title="Speak"
            >
              {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </Button>
          )}
        </div>
        <div
          className={
            isUser
              ? 'rounded-lg rounded-tr-none px-3 py-2 bg-secondary/40 border border-border/40 text-sm'
              : 'rounded-lg rounded-tl-none px-3 py-2 bg-card/60 border border-primary/30 text-sm hud-corner'
          }
        >
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          {!isUser && message.diagnostics && (
            <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
              {message.diagnostics.researchTriggered && (
                <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary/80 gap-1">
                  <Search className="h-2.5 w-2.5" />
                  RESEARCH: {message.diagnostics.researchQuery?.slice(0, 24)}
                  {message.diagnostics.researchQuery && message.diagnostics.researchQuery.length > 24 ? '...' : ''}
                </Badge>
              )}
              {message.diagnostics.researchHits !== undefined && message.diagnostics.researchHits > 0 && (
                <Badge variant="outline" className="text-[9px] font-mono border-border/40 text-muted-foreground">
                  {message.diagnostics.researchHits} SOURCES
                </Badge>
              )}
              {message.diagnostics.recalledEpisodes !== undefined && message.diagnostics.recalledEpisodes > 0 && (
                <Badge variant="outline" className="text-[9px] font-mono border-border/40 text-muted-foreground">
                  {message.diagnostics.recalledEpisodes} EPISODES RECALLED
                </Badge>
              )}
              {message.diagnostics.knowledgeGraphNodes !== undefined && (
                <Badge variant="outline" className="text-[9px] font-mono border-border/40 text-muted-foreground">
                  KG: {message.diagnostics.knowledgeGraphNodes}N / {message.diagnostics.knowledgeGraphEdges}E
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
