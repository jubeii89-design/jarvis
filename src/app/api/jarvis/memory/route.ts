/**
 * /api/jarvis/memory
 * GET  → returns the full 4-tier memory state for a session
 * POST → upserts an entity into the semantic knowledge graph
 * DELETE → clears short-term + sensory memory for a session
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureSession,
  getSensoryBuffer,
  clearSensoryBuffer,
  getShortTermContext,
  recallEpisodes,
  getKnowledgeGraph,
  upsertEntity,
  addRelation
} from '@/lib/jarvis/memory'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const sid = await ensureSession(sessionId ?? undefined)

  const [sensory, shortTerm, episodes, graph, researchLogs] = await Promise.all([
    Promise.resolve(getSensoryBuffer(sid)),
    getShortTermContext(sid, 50),
    db.episodicMemory.findMany({ where: { sessionId: sid }, orderBy: { createdAt: 'desc' }, take: 50 }),
    getKnowledgeGraph(100),
    db.researchLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  ])

  return NextResponse.json({
    sessionId: sid,
    tiers: {
      sensory: {
        label: 'Tier 1 — Sensory Buffer',
        description: 'Volatile raw input stream (last few seconds). Mirrors human iconic memory.',
        capacity: 8,
        entries: sensory
      },
      shortTerm: {
        label: 'Tier 2 — Short-Term Memory',
        description: 'Active conversation window. Bounded, with relevance decay.',
        capacity: 24,
        entries: shortTerm
      },
      episodic: {
        label: 'Tier 3 — Episodic Memory',
        description: 'Long-term vector log. Semantic similarity recall over past episodes.',
        entries: episodes.map(e => ({
          id: e.id,
          text: e.episodeText,
          tags: e.tags?.split(',').filter(Boolean) ?? [],
          importance: e.importance,
          createdAt: e.createdAt,
          lastRecalled: e.lastRecalled
        }))
      },
      semantic: {
        label: 'Tier 4 — Semantic Memory',
        description: 'Core knowledge graph: entities + relations.',
        nodes: graph.nodes,
        edges: graph.edges
      }
    },
    research: researchLogs
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sessionId = await ensureSession(body.sessionId)

  // Two modes: add entity, or add relation
  if (body.mode === 'relation') {
    const rel = await addRelation(body.subject, body.predicate, body.object, body.weight ?? 1.0)
    return NextResponse.json({ ok: true, relation: rel, sessionId })
  }
  const ent = await upsertEntity(body.name, body.type ?? 'concept', body.description, body.attributes)
  return NextResponse.json({ ok: true, entity: ent, sessionId })
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  clearSensoryBuffer(sessionId)
  await db.shortTermMemory.deleteMany({ where: { sessionId } })
  return NextResponse.json({ ok: true })
}
