/**
 * J.A.R.V.I.S. 4-Tier Memory Manager
 * ───────────────────────────────────────────────────────────────────────────
 * Tier 1 — Sensory Buffer   (volatile, last ~5 inputs, in-process Map)
 * Tier 2 — Short-Term       (active conversation window, DB-backed, decays)
 * Tier 3 — Episodic         (long-term vector log, semantic recall)
 * Tier 4 — Semantic         (knowledge graph: entities + relations)
 *
 * Designed for SQLite + small embedding model. For production scale you
 * would swap Tier 3 for pgvector / Pinecone / Weaviate and Tier 4 for
 * Neo4j / TigerGraph. The interface is intentionally storage-agnostic.
 */

import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// ─── In-process Sensory Buffer (Tier 1) ──────────────────────────────────────
// Bounded LRU per session. Volatile — lost on process restart, by design.
const SENSORY_CAPACITY = 8
const sensoryStore = new Map<string, Array<{ id: string; modality: string; raw: string; ts: number }>>()

function pushSensory(sessionId: string, modality: string, raw: string) {
  const list = sensoryStore.get(sessionId) ?? []
  list.push({ id: randomUUID(), modality, raw, ts: Date.now() })
  while (list.length > SENSORY_CAPACITY) list.shift()
  sensoryStore.set(sessionId, list)
}

export function getSensoryBuffer(sessionId: string) {
  return sensoryStore.get(sessionId) ?? []
}

export function clearSensoryBuffer(sessionId: string) {
  sensoryStore.delete(sessionId)
}

// ─── Short-Term Memory (Tier 2) ──────────────────────────────────────────────
const STM_CAPACITY = 24 // last N turns kept "hot"

export async function pushShortTerm(
  sessionId: string,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  tokens = 0
) {
  await db.shortTermMemory.create({
    data: { sessionId, role, content, tokens, relevance: 1.0 }
  })
  // Decay older entries: relevance *= 0.95, prune when below threshold or over capacity
  const all = await db.shortTermMemory.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: STM_CAPACITY + 8
  })
  const toDecay = all.slice(STM_CAPACITY)
  if (toDecay.length) {
    await db.shortTermMemory.deleteMany({
      where: { id: { in: toDecay.map(m => m.id) } }
    })
  }
}

export async function getShortTermContext(sessionId: string, limit = STM_CAPACITY) {
  const rows = await db.shortTermMemory.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return rows.reverse().map(r => ({ role: r.role as 'user' | 'assistant' | 'system' | 'tool', content: r.content }))
}

// ─── Episodic Memory (Tier 3) — Vector Log ───────────────────────────────────
// Lightweight embedding via character trigram hashing. Deterministic, no
// external API required. For production swap with real embedding model.

const TRIGRAM_BUCKETS = 384

function trigramHashEmbedding(text: string): number[] {
  const vec = new Array(TRIGRAM_BUCKETS).fill(0)
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  for (let i = 0; i < normalized.length - 2; i++) {
    const tri = normalized.slice(i, i + 3)
    if (tri.trim().length < 2) continue
    let hash = 0
    for (let j = 0; j < tri.length; j++) {
      hash = (hash * 31 + tri.charCodeAt(j)) >>> 0
    }
    vec[hash % TRIGRAM_BUCKETS] += 1
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / norm)
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export async function recordEpisode(
  sessionId: string,
  episodeText: string,
  opts: { tags?: string[]; emotion?: string; importance?: number } = {}
) {
  const embedding = trigramHashEmbedding(episodeText)
  await db.episodicMemory.create({
    data: {
      sessionId,
      episodeText,
      embedding: JSON.stringify(embedding),
      vectorDim: TRIGRAM_BUCKETS,
      tags: opts.tags?.join(','),
      emotion: opts.emotion,
      importance: opts.importance ?? 0.5,
      lastRecalled: new Date()
    }
  })
}

export async function recallEpisodes(sessionId: string, query: string, topK = 3): Promise<string[]> {
  const queryVec = trigramHashEmbedding(query)
  const candidates = await db.episodicMemory.findMany({
    where: { sessionId },
    orderBy: { importance: 'desc' },
    take: 64
  })
  if (!candidates.length) return []
  const scored = candidates.map(ep => {
    const vec = JSON.parse(ep.embedding) as number[]
    return { ep, score: cosineSimilarity(queryVec, vec) }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, topK)
  // bump lastRecalled
  await Promise.all(
    top.map(({ ep }) =>
      db.episodicMemory.update({ where: { id: ep.id }, data: { lastRecalled: new Date() } })
    )
  )
  return top.map(({ ep, score }) => `[${(score * 100).toFixed(0)}% match] ${ep.episodeText}`)
}

// ─── Semantic Memory (Tier 4) — Knowledge Graph ─────────────────────────────

export async function upsertEntity(name: string, type: string, description?: string, attributes?: Record<string, unknown>) {
  const existing = await db.entity.findUnique({ where: { name } })
  if (existing) {
    return db.entity.update({
      where: { id: existing.id },
      data: {
        type,
        description: description ?? existing.description,
        attributes: attributes ? JSON.stringify(attributes) : existing.attributes
      }
    })
  }
  return db.entity.create({
    data: { name, type, description, attributes: attributes ? JSON.stringify(attributes) : null }
  })
}

export async function addRelation(
  subjectName: string,
  predicate: string,
  objectName: string,
  weight = 1.0
) {
  const subject = await upsertEntity(subjectName, 'concept')
  const object = await upsertEntity(objectName, 'concept')
  return db.entityRelation.create({
    data: { subjectId: subject.id, objectId: object.id, predicate, weight }
  })
}

export async function getKnowledgeGraph(limit = 50) {
  const entities = await db.entity.findMany({ take: limit })
  const relations = await db.entityRelation.findMany({
    take: limit * 2,
    include: { subject: true, object: true }
  })
  return {
    nodes: entities.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      description: e.description,
      attributes: e.attributes ? JSON.parse(e.attributes) : null
    })),
    edges: relations.map(r => ({
      id: r.id,
      source: r.subject.name,
      target: r.object.name,
      predicate: r.predicate,
      weight: r.weight
    }))
  }
}

// ─── Session lifecycle ──────────────────────────────────────────────────────

export async function ensureSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const existing = await db.session.findUnique({ where: { id: sessionId } })
    if (existing) return sessionId
  }
  const session = await db.session.create({ data: { id: sessionId ?? undefined } })
  return session.id
}

// ─── Full recall bundle (for prompt assembly) ───────────────────────────────

export async function buildRecallBundle(sessionId: string, query: string) {
  const [sensory, shortTerm, episodes, graph] = await Promise.all([
    Promise.resolve(getSensoryBuffer(sessionId)),
    getShortTermContext(sessionId),
    recallEpisodes(sessionId, query, 3),
    getKnowledgeGraph(20)
  ])
  return { sensory, shortTerm, episodes, graph }
}
