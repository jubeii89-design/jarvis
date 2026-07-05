'use client'

import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  diagnostics?: {
    researchTriggered?: boolean
    researchQuery?: string | null
    researchHits?: number
    recalledEpisodes?: number
    knowledgeGraphNodes?: number
    knowledgeGraphEdges?: number
    sensoryBufferSize?: number
  }
}

export interface VoiceConfig {
  elevenlabsConfigured: boolean
  elevenlabsVoiceId: string | null
  fallbackEngine: string
}

export interface BrainConfig {
  engine: 'anthropic' | 'zai'
  model: string | null
  anthropicConfigured: boolean
  label: string
}

interface JarvisState {
  // session
  sessionId: string | null
  messages: ChatMessage[]
  thinking: boolean
  // voice
  voiceConfig: VoiceConfig | null
  speaking: boolean
  // brain
  brainConfig: BrainConfig | null
  // memory
  memorySnapshot: any | null
  memoryLoading: boolean
  // blueprint
  blueprint: any | null
  // actions
  setSessionId: (id: string | null) => void
  addMessage: (m: ChatMessage) => void
  setThinking: (t: boolean) => void
  setSpeaking: (s: boolean) => void
  setVoiceConfig: (c: VoiceConfig | null) => void
  setBrainConfig: (c: BrainConfig | null) => void
  setMemorySnapshot: (s: any | null) => void
  setMemoryLoading: (l: boolean) => void
  setBlueprint: (b: any | null) => void
  clearMessages: () => void
}

export const useJarvisStore = create<JarvisState>((set) => ({
  sessionId: null,
  messages: [],
  thinking: false,
  voiceConfig: null,
  speaking: false,
  brainConfig: null,
  memorySnapshot: null,
  memoryLoading: false,
  blueprint: null,
  setSessionId: (id) => set({ sessionId: id }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setThinking: (t) => set({ thinking: t }),
  setSpeaking: (s) => set({ speaking: s }),
  setVoiceConfig: (c) => set({ voiceConfig: c }),
  setBrainConfig: (c) => set({ brainConfig: c }),
  setMemorySnapshot: (s) => set({ memorySnapshot: s }),
  setMemoryLoading: (l) => set({ memoryLoading: l }),
  setBlueprint: (b) => set({ blueprint: b }),
  clearMessages: () => set({ messages: [] })
}))
