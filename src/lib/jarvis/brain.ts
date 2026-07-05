/**
 * J.A.R.V.I.S. Brain — LLM Reasoning Layer
 * ───────────────────────────────────────────────────────────────────────────
 * The brain is powered by Anthropic Claude when ANTHROPIC_API_KEY is set.
 * Otherwise it falls back to the z-ai-web-dev-sdk chat completions API.
 *
 * The brain is responsible for:
 *   - Producing JARVIS-voiced responses (personality enforced via system prompt)
 *   - Deciding when to invoke web research (function-calling style)
 *   - Synthesizing recalled memory + research results into the final reply
 */

import ZAI from 'z-ai-web-dev-sdk'
import { JARVIS_SYSTEM_PROMPT, JARVIS_FEW_SHOT_EXEMPLARS } from './personality'
import { queryWiki, getLintSummary } from './second-brain'

export type ChatMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string }

// ── Engine selection ────────────────────────────────────────────────────────
// Anthropic Claude is preferred when ANTHROPIC_API_KEY is present. Otherwise
// the z-ai-web-dev-sdk chat completions API is used as a drop-in stand-in.

type Engine = 'anthropic' | 'zai'

function detectEngine(): Engine {
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'zai'
}

let anthropicClient: import('@anthropic-ai/sdk').default | null = null
async function getAnthropic() {
  if (!anthropicClient) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZai() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

/**
 * Report which engine is active. Used by the /api/jarvis/brain/status endpoint
 * and displayed in the UI so the user knows which LLM is reasoning.
 */
export function getBrainEngine(): { engine: Engine; model: string | null } {
  const engine = detectEngine()
  return {
    engine,
    model: engine === 'anthropic'
      ? (process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022')
      : null
  }
}

// ── Core reasoning ──────────────────────────────────────────────────────────

/**
 * Core reasoning call. Accepts the assembled message history (already
 * includes recalled memory and short-term context). The system prompt and
 * few-shot exemplars are injected here.
 *
 * If Anthropic is configured but the API call fails (e.g. regional block,
 * rate limit, invalid key), we gracefully fall back to the z-ai SDK so the
 * conversation never breaks.
 */
export async function think(messages: ChatMessage[]): Promise<string> {
  const engine = detectEngine()
  if (engine === 'anthropic') {
    try {
      return await thinkAnthropic(messages)
    } catch (err) {
      console.error('Anthropic brain failed, falling back to z-ai SDK:', err instanceof Error ? err.message : err)
      return thinkZai(messages)
    }
  }
  return thinkZai(messages)
}

async function thinkAnthropic(messages: ChatMessage[]): Promise<string> {
  const client = await getAnthropic()
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'

  // Anthropic API separates the system prompt from the messages array.
  // Few-shot exemplars become the opening user/assistant turns.
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...JARVIS_FEW_SHOT_EXEMPLARS,
    ...messages
  ].map(m => ({
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: m.content
  }))

  // Anthropic requires the conversation to start with a user turn. If the
  // first message after exemplars is a system/tool message, fold it into
  // the following user message.
  while (conversation.length && conversation[0].role !== 'user') {
    conversation.shift()
  }

  const resp = await client.messages.create({
    model,
    max_tokens: 1024,
    system: JARVIS_SYSTEM_PROMPT,
    messages: conversation,
    temperature: 0.7
  })

  // Extract text content blocks
  const textBlocks = resp.content.filter(b => b.type === 'text')
  return textBlocks.map(b => (b as any).text).join('\n').trim()
}

async function thinkZai(messages: ChatMessage[]): Promise<string> {
  const client = await getZai()
  const full: ChatMessage[] = [
    { role: 'system', content: JARVIS_SYSTEM_PROMPT },
    ...JARVIS_FEW_SHOT_EXEMPLARS,
    ...messages
  ]
  const completion = await client.chat.completions.create({
    messages: full as any,
    thinking: { type: 'disabled' },
    temperature: 0.7
  })
  return completion.choices[0]?.message?.content ?? ''
}

// ── Router ──────────────────────────────────────────────────────────────────

/**
 * Quick classification: does the user's latest message require web research?
 * Returns a structured tool call if so, otherwise null.
 *
 * We use the LLM itself as the router to keep the architecture clean.
 */
export async function shouldResearch(userMessage: string): Promise<{ query: string } | null> {
  const routerPrompt = `You are a routing layer for JARVIS. Decide whether the user's latest message requires fresh information from the web (news, current events, recent research, lookups, technical specs, anything not stable general knowledge).

Reply with ONLY a JSON object, no commentary:
- If research is needed: {"research": true, "query": "<concise search query>"}
- If not: {"research": false}

User message: """${userMessage.replace(/"""/g, '')}"""`

  try {
    const engine = detectEngine()
    let text: string
    if (engine === 'anthropic') {
      try {
        text = await thinkAnthropic([{ role: 'user', content: routerPrompt }])
      } catch {
        // Anthropic failed — fall back to z-ai for routing
        const client = await getZai()
        const completion = await client.chat.completions.create({
          messages: [{ role: 'user', content: routerPrompt }],
          thinking: { type: 'disabled' },
          temperature: 0.2
        })
        text = completion.choices[0]?.message?.content ?? ''
      }
    } else {
      const client = await getZai()
      const completion = await client.chat.completions.create({
        messages: [{ role: 'user', content: routerPrompt }],
        thinking: { type: 'disabled' },
        temperature: 0.2
      })
      text = completion.choices[0]?.message?.content ?? ''
    }
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (parsed.research && parsed.query) return { query: String(parsed.query) }
    return null
  } catch {
    return null
  }
}

/**
 * Synthesize a final JARVIS reply given the original question, the
 * recalled memory bundle, and (optionally) the research results.
 */
export async function synthesizeReply(opts: {
  userMessage: string
  history: ChatMessage[]
  recalledEpisodes: string[]
  knowledgeGraph?: { nodes: number; edges: number }
  researchResults?: Array<{ title: string; url: string; snippet: string }>
}): Promise<string> {
  const { userMessage, history, recalledEpisodes, knowledgeGraph, researchResults } = opts

  // Query the Second Brain compiled wiki first — this is Tier 5.
  // Compiled pages contain synthesis; stubs contain raw content.
  // Both are useful — stubs give JARVIS access to ingested-but-not-yet-compiled knowledge.
  const wikiHits = await queryWiki(userMessage, 2).catch(() => [])
  const lintSummary = await getLintSummary().catch(() => null)

  const contextParts: string[] = []

  // Tier 5: Compiled wiki knowledge — injected as the highest-priority context
  if (wikiHits.length) {
    const wikiBlock = wikiHits.map(h => {
      const status = h.compiled ? 'compiled' : 'stub (awaiting compilation)'
      const age = h.compiledAt
        ? ` · compiled ${new Date(h.compiledAt).toISOString().slice(0, 10)}`
        : ''
      return `### ${h.title} [${status}${age}]\n\n${h.body}`
    }).join('\n\n---\n\n')
    contextParts.push(`[COMPILED_KNOWLEDGE]\nThe following wiki page(s) from your Second Brain are relevant. Cite them as "my notes on X" or "according to my compiled knowledge of X". If the page is a stub, note that the knowledge is not yet fully synthesized.\n\n${wikiBlock}`)
  }

  if (recalledEpisodes.length) {
    contextParts.push(
      `[RECALLED_EPISODES]\n${recalledEpisodes.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    )
  }
  if (knowledgeGraph && (knowledgeGraph.nodes || knowledgeGraph.edges)) {
    contextParts.push(
      `[KNOWLEDGE_GRAPH]\nKnowledge graph contains ${knowledgeGraph.nodes} entities and ${knowledgeGraph.edges} relations. Relevant fragments will be referenced if needed.`
    )
  }
  if (researchResults?.length) {
    contextParts.push(
      `[RESEARCH_RESULTS]\n${researchResults
        .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`)
        .join('\n')}`
    )
  }

  // Phase 4: Linting loop — surface knowledge gaps proactively
  if (lintSummary && (lintSummary.gaps > 0 || lintSummary.stale > 0)) {
    const issues: string[] = []
    if (lintSummary.gaps > 0) issues.push(`${lintSummary.gaps} knowledge gap(s)`)
    if (lintSummary.stale > 0) issues.push(`${lintSummary.stale} stale page(s)`)
    if (issues.length) {
      contextParts.push(`[SECOND_BRAIN_HEALTH]\nSecond Brain lint identified ${issues.join(' and ')}. If the user's question touches on a gap or stale area, briefly note it and offer to compile: "Sir, my notes on this could be refreshed. Shall I run compilation?"`)
    }
  }

  const contextBlock = contextParts.length ? `\n\n${contextParts.join('\n\n')}\n\n` : ''

  const messages: ChatMessage[] = [
    ...history,
    {
      role: 'user',
      content: `${contextBlock}The user's request follows. Respond in character as JARVIS.\n\nUser: ${userMessage}`
    }
  ]

  return think(messages)
}

// ── Voice synthesis (ElevenLabs with z-ai fallback) ────────────────────────

/**
 * Voice synthesis via ElevenLabs.
 *
 * ELEVENLABS_API_KEY must be set in the environment. The user is expected
 * to clone the JARVIS voice (Paul Bettany timbre) into their ElevenLabs
 * account using the voice samples referenced in the UI's "Voice Setup"
 * panel, then set ELEVENLABS_VOICE_ID to the cloned voice's ID.
 *
 * If ElevenLabs is not configured, we transparently fall back to the
 * z-ai-web-dev-sdk TTS endpoint so the assistant remains audible.
 */
export async function speak(text: string): Promise<{ audio: Buffer; contentType: string; engine: string }> {
  const elevenKey = process.env.ELEVENLABS_API_KEY
  const elevenVoice = process.env.ELEVENLABS_VOICE_ID

  if (elevenKey && elevenVoice) {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true }
      })
    })
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer())
      return { audio: buf, contentType: 'audio/mpeg', engine: 'elevenlabs' }
    }
    // fall through to fallback
  }

  // Fallback: z-ai-web-dev-sdk TTS
  const client = await getZai()
  const ttsResp = await client.audio.tts.create({
    input: text,
    voice: 'tongtong',
    response_format: 'wav',
    stream: false
  })
  const buf = Buffer.from(await ttsResp.arrayBuffer())
  return { audio: buf, contentType: 'audio/wav', engine: 'zai-fallback' }
}
