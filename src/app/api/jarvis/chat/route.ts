/**
 * POST /api/jarvis/chat
 * ───────────────────────────────────────────────────────────────────────────
 * Main JARVIS conversational endpoint. Pipeline:
 *   1. Persist user input to sensory buffer + short-term memory
 *   2. Build recall bundle (episodes + knowledge graph stats)
 *   3. Ask brain whether web research is needed
 *   4. If yes → run research, store results as a tool message in STM
 *   5. Synthesize final JARVIS reply
 *   6. Persist reply to STM; record episode to episodic memory
 *   7. Return reply + diagnostics
 */

import { NextRequest, NextResponse } from 'next/server'
import { ensureSession, pushShortTerm, getShortTermContext, getSensoryBuffer, recallEpisodes, recordEpisode, getKnowledgeGraph } from '@/lib/jarvis/memory'
import { think, shouldResearch, synthesizeReply } from '@/lib/jarvis/brain'
import { researchWeb } from '@/lib/jarvis/research'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatRequestBody {
  message: string
  sessionId?: string
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = (await req.json()) as ChatRequestBody
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // 1. Session + sensory buffer + STM
    const sid = await ensureSession(sessionId)
    await pushShortTerm(sid, 'user', message, estimateTokens(message))

    // 2. Recall bundle
    const [recalled, graph] = await Promise.all([
      recallEpisodes(sid, message, 3),
      getKnowledgeGraph(20)
    ])

    // 3. Decide on research
    const researchDecision = await shouldResearch(message)
    let researchSummary: { query: string; hits: number; topHits: Array<{ title: string; url: string; snippet: string }> } | null = null
    if (researchDecision) {
      try {
        const result = await researchWeb(researchDecision.query, { num: 6, readPages: 2 })
        researchSummary = {
          query: researchDecision.query,
          hits: result.hits.length,
          topHits: result.hits.slice(0, 5)
        }
        // Inject research as a tool message
        const toolMsg = `Research complete for "${researchDecision.query}". ${result.hits.length} sources found. Top results:\n${result.hits
          .slice(0, 5)
          .map((h, i) => `${i + 1}. ${h.title} — ${h.url}\n   ${h.snippet}`.slice(0, 400))
          .join('\n')}${result.pages.length ? `\n\nFull text excerpts:\n${result.pages.map(p => `--- ${p.title} (${p.url}) ---\n${p.text.slice(0, 1500)}`).join('\n\n')}` : ''}`
        await pushShortTerm(sid, 'tool', toolMsg, estimateTokens(toolMsg))
      } catch (err) {
        // Research failure should not block the conversation
        console.error('Research failed:', err)
      }
    }

    // 4. Build short-term context for the brain
    const history = await getShortTermContext(sid, 20)

    // 5. Synthesize reply
    const reply = await synthesizeReply({
      userMessage: message,
      history,
      recalledEpisodes: recalled,
      knowledgeGraph: { nodes: graph.nodes.length, edges: graph.edges.length },
      researchResults: researchSummary?.topHits
    })

    // 6. Persist reply + episode
    await pushShortTerm(sid, 'assistant', reply, estimateTokens(reply))
    await recordEpisode(sid, `User: ${message}\nJARVIS: ${reply}`, {
      tags: researchDecision ? ['research', researchDecision.query] : ['chat'],
      importance: researchDecision ? 0.7 : 0.5
    })

    // 7. Return
    return NextResponse.json({
      sessionId: sid,
      reply,
      diagnostics: {
        researchTriggered: !!researchDecision,
        researchQuery: researchDecision?.query ?? null,
        researchHits: researchSummary?.hits ?? 0,
        recalledEpisodes: recalled.length,
        knowledgeGraphNodes: graph.nodes.length,
        knowledgeGraphEdges: graph.edges.length,
        sensoryBufferSize: getSensoryBuffer(sid).length
      }
    })
  } catch (err) {
    console.error('JARVIS chat error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'JARVIS encountered an error', detail: message }, { status: 500 })
  }
}

function estimateTokens(text: string): number {
  // rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4)
}
