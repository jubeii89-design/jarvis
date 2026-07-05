/**
 * J.A.R.V.I.S. Second Brain — Karpathy-style compiled knowledge base
 * ───────────────────────────────────────────────────────────────────────────
 * A folder of markdown files that Claude compiles from raw input.
 * This is Tier 5 of JARVIS's memory architecture — the compiled wiki.
 *
 * Operations:
 *   - ingest:  read RAW/ files, create stub wiki pages with metadata
 *   - compile: (Claude) enrich stub pages with synthesis, links, summaries
 *   - link:    scan [[wikilinks]], build backlinks, update MOCs
 *   - lint:    health checks (gaps, stale, broken links, orphans)
 *
 * Folder structure:
 *   second-brain/
 *   ├── RAW/{articles,transcripts,notes,pdfs}/   # drop unsorted content here
 *   ├── wiki/{people,projects,concepts,events,indexes}/  # compiled pages
 *   ├── .lint/        # health check reports
 *   └── .meta/        # manifest.json, graph.json
 */

import { promises as fs } from 'fs'
import path from 'path'

export const SECOND_BRAIN_DIR = '/home/z/my-project/second-brain'
export const RAW_DIR = path.join(SECOND_BRAIN_DIR, 'RAW')
export const WIKI_DIR = path.join(SECOND_BRAIN_DIR, 'wiki')
export const LINT_DIR = path.join(SECOND_BRAIN_DIR, '.lint')
export const META_DIR = path.join(SECOND_BRAIN_DIR, '.meta')
export const PROCESSED_DIR = path.join(RAW_DIR, '.processed')

export type WikiType = 'people' | 'projects' | 'concepts' | 'events' | 'indexes'

export interface WikiFrontmatter {
  title: string
  type: WikiType | 'raw'
  tags: string[]
  related: string[] // [[wikilinks]]
  sources: string[]
  compiled_at: string | null
  compiled_by: string | null // 'claude' | 'jarvis-stub' | null
  raw_source: string | null // path to original RAW file
  staleness_days: number | null
}

export interface WikiPage {
  slug: string           // filename without .md
  path: string           // full path
  relativePath: string   // e.g. "concepts/fusion-energy.md"
  frontmatter: WikiFrontmatter
  body: string           // markdown body (after frontmatter)
  rawContent: string     // full file content
  wordCount: number
  compiled: boolean      // true if compiled_by !== 'jarvis-stub'
}

export interface SecondBrainStatus {
  rawFiles: number
  rawByType: Record<string, number>
  wikiPages: number
  wikiByType: Record<string, number>
  compiledPages: number
  stubPages: number
  orphanPages: number
  lastCompiledAt: string | null
  totalWords: number
  lintSummary: { gaps: number; stale: number; brokenLinks: number; orphans: number } | null
}

// ─── Frontmatter parsing ────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

export function parseFrontmatter(content: string): { frontmatter: Partial<WikiFrontmatter>; body: string } {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: {}, body: content }
  const yaml = match[1]
  const body = match[2]
  const fm: Partial<WikiFrontmatter> = { tags: [], related: [], sources: [] }
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const [, key, val] = m
    if (key === 'tags' || key === 'related' || key === 'sources') {
      // parse as YAML list: [item, item] or "item, item"
      const list = val.replace(/^\[/, '').replace(/\]$/, '').split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
      ;(fm as any)[key] = list
    } else {
      ;(fm as any)[key] = val.replace(/^"|"$/g, '')
    }
  }
  return { frontmatter: fm, body }
}

export function serializeFrontmatter(fm: WikiFrontmatter): string {
  const lines = [
    `title: "${fm.title.replace(/"/g, '\\"')}"`,
    `type: ${fm.type}`,
    `tags: [${fm.tags.map(t => `"${t}"`).join(', ')}]`,
    `related: [${fm.related.map(r => `"${r}"`).join(', ')}]`,
    `sources: [${fm.sources.map(s => `"${s}"`).join(', ')}]`,
    `compiled_at: ${fm.compiled_at ? `"${fm.compiled_at}"` : 'null'}`,
    `compiled_by: ${fm.compiled_by ? `"${fm.compiled_by}"` : 'null'}`,
    `raw_source: ${fm.raw_source ? `"${fm.raw_source}"` : 'null'}`,
    `staleness_days: ${fm.staleness_days ?? 'null'}`
  ]
  return `---\n${lines.join('\n')}\n---\n`
}

// ─── File operations ────────────────────────────────────────────────────────

export async function ensureDirs() {
  for (const dir of [RAW_DIR, WIKI_DIR, LINT_DIR, META_DIR, PROCESSED_DIR,
    path.join(RAW_DIR, 'articles'), path.join(RAW_DIR, 'transcripts'),
    path.join(RAW_DIR, 'notes'), path.join(RAW_DIR, 'pdfs'),
    path.join(WIKI_DIR, 'people'), path.join(WIKI_DIR, 'projects'),
    path.join(WIKI_DIR, 'concepts'), path.join(WIKI_DIR, 'events'),
    path.join(WIKI_DIR, 'indexes')]) {
    await fs.mkdir(dir, { recursive: true })
  }
}

export async function listRawFiles(): Promise<Array<{ path: string; relativePath: string; size: number; type: string }>> {
  await ensureDirs()
  const result: Array<{ path: string; relativePath: string; size: number; type: string }> = []
  const subdirs = ['articles', 'transcripts', 'notes', 'pdfs']
  for (const sub of subdirs) {
    const dir = path.join(RAW_DIR, sub)
    try {
      const entries = await fs.readdir(dir)
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = await fs.stat(fullPath)
        if (stat.isFile()) {
          result.push({
            path: fullPath,
            relativePath: `RAW/${sub}/${entry}`,
            size: stat.size,
            type: sub
          })
        }
      }
    } catch {}
  }
  return result
}

export async function listWikiPages(): Promise<WikiPage[]> {
  await ensureDirs()
  const pages: WikiPage[] = []
  const types: WikiType[] = ['people', 'projects', 'concepts', 'events', 'indexes']
  for (const type of types) {
    const dir = path.join(WIKI_DIR, type)
    try {
      const entries = await fs.readdir(dir)
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue
        const fullPath = path.join(dir, entry)
        const content = await fs.readFile(fullPath, 'utf8')
        const { frontmatter, body } = parseFrontmatter(content)
        const fm: WikiFrontmatter = {
          title: frontmatter.title ?? entry.replace(/\.md$/, ''),
          type: frontmatter.type ?? type,
          tags: frontmatter.tags ?? [],
          related: frontmatter.related ?? [],
          sources: frontmatter.sources ?? [],
          compiled_at: frontmatter.compiled_at ?? null,
          compiled_by: frontmatter.compiled_by ?? null,
          raw_source: frontmatter.raw_source ?? null,
          staleness_days: frontmatter.staleness_days ?? null
        }
        pages.push({
          slug: entry.replace(/\.md$/, ''),
          path: fullPath,
          relativePath: `wiki/${type}/${entry}`,
          frontmatter: fm,
          body,
          rawContent: content,
          wordCount: body.split(/\s+/).filter(Boolean).length,
          compiled: fm.compiled_by !== 'jarvis-stub' && fm.compiled_by !== null
        })
      }
    } catch {}
  }
  return pages
}

export async function readWikiPage(type: WikiType, slug: string): Promise<WikiPage | null> {
  const fullPath = path.join(WIKI_DIR, type, `${slug}.md`)
  try {
    const content = await fs.readFile(fullPath, 'utf8')
    const { frontmatter, body } = parseFrontmatter(content)
    return {
      slug,
      path: fullPath,
      relativePath: `wiki/${type}/${slug}.md`,
      frontmatter: {
        title: frontmatter.title ?? slug,
        type: frontmatter.type ?? type,
        tags: frontmatter.tags ?? [],
        related: frontmatter.related ?? [],
        sources: frontmatter.sources ?? [],
        compiled_at: frontmatter.compiled_at ?? null,
        compiled_by: frontmatter.compiled_by ?? null,
        raw_source: frontmatter.raw_source ?? null,
        staleness_days: frontmatter.staleness_days ?? null
      },
      body,
      rawContent: content,
      wordCount: body.split(/\s+/).filter(Boolean).length,
      compiled: frontmatter.compiled_by !== 'jarvis-stub' && frontmatter.compiled_by !== null
    }
  } catch {
    return null
  }
}

export async function writeWikiPage(type: WikiType, slug: string, frontmatter: WikiFrontmatter, body: string): Promise<string> {
  await ensureDirs()
  const fullPath = path.join(WIKI_DIR, type, `${slug}.md`)
  const content = serializeFrontmatter(frontmatter) + '\n' + body
  await fs.writeFile(fullPath, content, 'utf8')
  return fullPath
}

export async function moveRawToProcessed(rawPath: string): Promise<void> {
  await fs.mkdir(PROCESSED_DIR, { recursive: true })
  const basename = path.basename(rawPath)
  const dest = path.join(PROCESSED_DIR, `${Date.now()}-${basename}`)
  await fs.rename(rawPath, dest)
}

// ─── Slugification ──────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

// ─── Status ─────────────────────────────────────────────────────────────────

export async function getStatus(): Promise<SecondBrainStatus> {
  const [rawFiles, wikiPages] = await Promise.all([listRawFiles(), listWikiPages()])
  const rawByType: Record<string, number> = {}
  for (const f of rawFiles) rawByType[f.type] = (rawByType[f.type] ?? 0) + 1
  const wikiByType: Record<string, number> = {}
  for (const p of wikiPages) wikiByType[p.frontmatter.type] = (wikiByType[p.frontmatter.type] ?? 0) + 1
  const compiledPages = wikiPages.filter(p => p.compiled).length
  const stubPages = wikiPages.filter(p => !p.compiled).length
  const totalWords = wikiPages.reduce((s, p) => s + p.wordCount, 0)
  const compiledDates = wikiPages.map(p => p.frontmatter.compiled_at).filter(Boolean).sort().reverse()
  const lastCompiledAt = compiledDates[0] ?? null

  // Read lint summary if available
  let lintSummary: SecondBrainStatus['lintSummary'] = null
  try {
    const lintContent = await fs.readFile(path.join(LINT_DIR, 'summary.json'), 'utf8')
    lintSummary = JSON.parse(lintContent)
  } catch {}

  return {
    rawFiles: rawFiles.length,
    rawByType,
    wikiPages: wikiPages.length,
    wikiByType,
    compiledPages,
    stubPages,
    orphanPages: 0, // computed in lint
    lastCompiledAt,
    totalWords,
    lintSummary
  }
}

// ─── Wikilink extraction ────────────────────────────────────────────────────

export function extractWikilinks(text: string): string[] {
  const links = new Set<string>()
  const re = /\[\[([^\]]+)\]\]/g
  let m
  while ((m = re.exec(text)) !== null) {
    links.add(m[1])
  }
  return Array.from(links)
}

// ─── Manifest ───────────────────────────────────────────────────────────────

export async function updateManifest(operation: string): Promise<void> {
  await fs.mkdir(META_DIR, { recursive: true })
  const manifestPath = path.join(META_DIR, 'manifest.json')
  let manifest: any = {}
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch {}
  manifest.lastOperation = operation
  manifest.lastOperationAt = new Date().toISOString()
  manifest.operations = (manifest.operations ?? 0) + 1
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
}

// ─── Wiki query (for synthesizeReply integration) ──────────────────────────

/**
 * Query the compiled wiki for pages relevant to a user message.
 * Returns the top-K pages ranked by simple keyword overlap.
 *
 * In production this would use embeddings (same as episodic memory),
 * but keyword overlap is fast, dependency-free, and works well for
 * compiled pages (which have rich titles and tags).
 */
export async function queryWiki(query: string, topK = 2): Promise<Array<{
  slug: string
  title: string
  type: string
  body: string
  compiled: boolean
  compiledAt: string | null
  score: number
  stalenessDays: number | null
}>> {
  const pages = await listWikiPages()
  if (pages.length === 0) return []

  // Tokenize query — lowercase, split on non-alphanumeric
  const queryTokens = new Set(
    query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  )
  if (queryTokens.size === 0) return []

  const scored = pages.map(p => {
    // Build a text blob to match against
    const blob = `${p.frontmatter.title} ${p.frontmatter.tags.join(' ')} ${p.body}`.toLowerCase()
    let score = 0
    for (const token of queryTokens) {
      // Count occurrences
      const re = new RegExp(`\\b${token}`, 'g')
      const matches = blob.match(re)
      if (matches) score += matches.length
    }
    // Boost title matches
    const titleLower = p.frontmatter.title.toLowerCase()
    for (const token of queryTokens) {
      if (titleLower.includes(token)) score += 5
    }
    // Boost compiled pages
    if (p.compiled) score *= 1.5
    return { page: p, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({
      slug: s.page.slug,
      title: s.page.frontmatter.title,
      type: s.page.frontmatter.type,
      body: s.page.body.slice(0, 4000), // cap to stay under context window
      compiled: s.page.compiled,
      compiledAt: s.page.frontmatter.compiled_at,
      score: s.score,
      stalenessDays: s.page.frontmatter.staleness_days
    }))
}

/**
 * Get the current lint summary for surfacing in chat.
 */
export async function getLintSummary(): Promise<{ gaps: number; stale: number; brokenLinks: number; orphans: number; generatedAt: string } | null> {
  try {
    const content = await fs.readFile(path.join(LINT_DIR, 'summary.json'), 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}
