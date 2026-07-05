/**
 * POST /api/jarvis/second-brain/compile
 * ───────────────────────────────────────────────────────────────────────────
 * Master compilation operation. For each stub wiki page (compiled_by:
 * 'jarvis-stub'), invokes the brain to:
 *   - Synthesize a proper summary
 *   - Extract key facts
 *   - Identify connections to other knowledge (as [[wikilinks]])
 *   - Note open questions
 *   - Extract entities for the knowledge graph
 *
 * Also re-compiles stale pages (compiled > 30 days ago) if refresh=true.
 *
 * After compilation, runs link + lint automatically to update backlinks
 * and surface gaps.
 *
 * Uses whichever brain engine is active (Anthropic Claude if configured
 * and reachable, otherwise z-ai SDK fallback). The compilation prompt is
 * the same — the Second Brain works without Claude.
 *
 * Body (optional): { slug?: string, refresh?: boolean, maxPages?: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { listWikiPages, writeWikiPage, readWikiPage, updateManifest, ensureDirs, WikiPage } from '@/lib/jarvis/second-brain'
import { think } from '@/lib/jarvis/brain'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — compilation is heavy

const STALE_THRESHOLD_DAYS = 30

interface CompileResult {
  compiled: Array<{ slug: string; title: string; type: string }>
  skipped: Array<{ slug: string; reason: string }>
  errors: Array<{ slug: string; error: string }>
}

export async function POST(req: NextRequest) {
  try {
    await ensureDirs()
    const body = await req.json().catch(() => ({}))
    const targetSlug = body.slug as string | undefined
    const refresh = body.refresh === true
    const maxPages = Math.min(body.maxPages ?? 10, 25)

    const pages = await listWikiPages()
    const now = Date.now()

    // Select pages to compile
    const toCompile: WikiPage[] = []
    for (const p of pages) {
      if (p.frontmatter.type === 'indexes') continue // don't compile MOCs
      if (targetSlug && p.slug !== targetSlug) continue

      if (!p.compiled) {
        // Stub — needs compilation
        toCompile.push(p)
      } else if (refresh && p.frontmatter.compiled_at) {
        // Compiled but stale — refresh
        const age = (now - new Date(p.frontmatter.compiled_at).getTime()) / (1000 * 60 * 60 * 24)
        if (age >= STALE_THRESHOLD_DAYS) toCompile.push(p)
      }
      if (toCompile.length >= maxPages) break
    }

    if (toCompile.length === 0) {
      return NextResponse.json({
        ok: true,
        compiled: [],
        skipped: [],
        errors: [],
        message: targetSlug
          ? `Page "${targetSlug}" is already compiled${refresh ? ' and not stale' : ''}. Pass refresh=true to force recompilation.`
          : 'No stub or stale pages to compile. All wiki pages are up to date.'
      })
    }

    const result: CompileResult = { compiled: [], skipped: [], errors: [] }

    // Get all existing page titles/slugs for cross-referencing
    const allTitles = pages.map(p => ({ slug: p.slug, title: p.frontmatter.title, type: p.frontmatter.type }))
    const contextList = allTitles.map(t => `- [[${t.slug}]] (${t.type}): ${t.title}`).join('\n')

    for (const page of toCompile) {
      try {
        const prompt = `You are compiling a wiki page for JARVIS's Second Brain. Read the raw content below and produce a structured wiki page in markdown.

## Existing wiki pages (for cross-referencing)
Use [[wikilinks]] to reference these where relevant:

${contextList}

## Raw content to compile

Title: ${page.frontmatter.title}
Source: ${page.frontmatter.raw_source ?? 'unknown'}

${page.body}

## Output format

Produce ONLY the markdown body (no frontmatter — the system will add it). Structure:

## Summary

2-3 paragraph synthesis of the key information. Write in clear, declarative prose. This is the compiled knowledge — not a description of the source.

## Key Facts

- Bullet list of extracted facts, each self-contained and verifiable from the source
- Each fact should be a complete sentence

## Connections

Prose explaining how this content relates to existing knowledge. Use [[wikilinks]] to reference other pages. If no existing page applies, note potential new pages as [[red-links]] for future compilation.

## Open Questions

- Questions worth following up on
- Gaps in the source material
- Research directions

## Extracted Entities

List people, projects, concepts, and events mentioned, each on its own line:
- PERSON: name — role/context
- PROJECT: name — description
- CONCEPT: name — definition
- EVENT: name — date/context

## Tags

Comma-separated list of 3-7 topic tags (lowercase, hyphenated).

Produce the wiki page now:`

        const compiledBody = await think([{ role: 'user', content: prompt }])

        if (!compiledBody || compiledBody.length < 50) {
          result.errors.push({ slug: page.slug, error: 'Brain returned empty or too-short response' })
          continue
        }

        // Extract tags from the body (last section)
        const tagsMatch = compiledBody.match(/## Tags\s*\n\s*([^\n#]+)/i)
        const tags = tagsMatch
          ? tagsMatch[1].split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean).slice(0, 7)
          : ['compiled']

        // Write the compiled page
        await writeWikiPage(page.frontmatter.type as any, page.slug, {
          ...page.frontmatter,
          tags: tags.includes('compiled') ? tags : [...tags, 'compiled'],
          compiled_at: new Date().toISOString(),
          compiled_by: 'jarvis-brain',
          staleness_days: 0
        }, compiledBody)

        result.compiled.push({ slug: page.slug, title: page.frontmatter.title, type: page.frontmatter.type })
      } catch (err) {
        result.errors.push({ slug: page.slug, error: err instanceof Error ? err.message : String(err) })
      }
    }

    await updateManifest('compile')

    // Auto-run link + lint after compilation
    try {
      await fetch('http://localhost:3000/api/jarvis/second-brain/link', { method: 'POST' })
      await fetch('http://localhost:3000/api/jarvis/second-brain/lint', { method: 'POST' })
    } catch {}

    return NextResponse.json({
      ok: true,
      ...result,
      message: result.compiled.length
        ? `Compiled ${result.compiled.length} page(s). Link and lint passes run automatically.`
        : 'No pages were compiled. Check errors for details.'
    })
  } catch (err) {
    return NextResponse.json({ error: 'Compile failed', detail: String(err) }, { status: 500 })
  }
}
