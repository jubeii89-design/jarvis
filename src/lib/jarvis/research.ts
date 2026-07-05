/**
 * J.A.R.V.I.S. Research Client
 * ───────────────────────────────────────────────────────────────────────────
 * Wraps the z-ai-web-dev-sdk `web_search` and `page_reader` functions to
 * give JARVIS the ability to research the web on demand.
 *
 * Pipeline:
 *   1. web_search  → returns list of {title, url, snippet}
 *   2. (optional) page_reader on top 1-2 URLs → returns full article text
 *   3. Synthesis happens in the brain (synthesizeReply with researchResults)
 */

import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export interface ResearchHit {
  title: string
  url: string
  snippet: string
  publishedAt?: string
}

export interface ResearchResult {
  query: string
  hits: ResearchHit[]
  pages: Array<{ url: string; title: string; text: string }>
  logId: string
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getClient() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

export async function researchWeb(query: string, opts: { num?: number; recencyDays?: number; readPages?: number } = {}): Promise<ResearchResult> {
  const client = await getClient()
  const num = opts.num ?? 6
  const recencyDays = opts.recencyDays ?? 30
  const readPages = opts.readPages ?? 2

  // 1) Web search
  const raw: any = await client.functions.invoke('web_search', {
    query,
    num,
    recency_days: recencyDays
  })

  const hits: ResearchHit[] = normalizeSearchResults(raw)

  // 2) Read top N pages
  const pages: Array<{ url: string; title: string; text: string }> = []
  for (const hit of hits.slice(0, readPages)) {
    try {
      const page: any = await client.functions.invoke('page_reader', { url: hit.url })
      const text = extractPageText(page)
      if (text) pages.push({ url: hit.url, title: hit.title, text })
    } catch {
      // skip pages that fail to read
    }
  }

  // 3) Persist a research log entry
  const log = await db.researchLog.create({
    data: {
      query,
      strategy: 'keyword',
      resultCount: hits.length,
      topSources: JSON.stringify(hits.slice(0, 5)),
      summary: null
    }
  })

  return { query, hits, pages, logId: log.id }
}

// ─── Normalization helpers ──────────────────────────────────────────────────
// The web_search function may return an array directly, or wrap results
// under various keys depending on the underlying provider. Handle them all.

function normalizeSearchResults(raw: any): ResearchHit[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeHit)
  if (Array.isArray(raw.results)) return raw.results.map(normalizeHit)
  if (Array.isArray(raw.data)) return raw.data.map(normalizeHit)
  if (raw?.choices?.[0]?.message?.content) {
    // Some providers return the result as an LLM message — try to extract URLs
    const text = String(raw.choices[0].message.content)
    const urls = Array.from(text.matchAll(/https?:\/\/[^\s)"']+/g)).map(m => m[0])
    return urls.slice(0, 6).map(url => ({ title: url, url, snippet: '' }))
  }
  return []
}

function normalizeHit(h: any): ResearchHit {
  return {
    title: h.title ?? h.name ?? h.headline ?? h.url ?? 'Untitled',
    url: h.url ?? h.link ?? h.href ?? '',
    snippet: h.snippet ?? h.summary ?? h.description ?? h.abstract ?? '',
    publishedAt: h.publishedAt ?? h.date ?? h.published_time ?? h.publish_date
  }
}

function extractPageText(page: any): string {
  if (!page) return ''
  if (typeof page === 'string') return page
  if (page.text) return page.text
  if (page.content) return typeof page.content === 'string' ? page.content : JSON.stringify(page.content)
  if (page.html) {
    // strip HTML tags
    return String(page.html).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
  }
  if (page.markdown) return page.markdown
  return ''
}
