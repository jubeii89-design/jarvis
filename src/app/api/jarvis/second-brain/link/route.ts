/**
 * POST /api/jarvis/second-brain/link
 * ───────────────────────────────────────────────────────────────────────────
 * Scans all wiki pages for [[wikilinks]], resolves them to actual files,
 * updates each page's "Related" frontmatter with backlinks, and updates
 * the MOC (Map of Content) index pages.
 *
 * Also materializes the link graph to .meta/graph.json for fast traversal
 * and the lint operation's orphan detection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import {
  listWikiPages, extractWikilinks, serializeFrontmatter, writeWikiPage,
  updateManifest, WIKI_DIR, META_DIR, ensureDirs, WikiPage
} from '@/lib/jarvis/second-brain'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    await ensureDirs()
    const pages = await listWikiPages()

    // Build slug → page index
    const slugIndex = new Map<string, WikiPage>()
    for (const p of pages) slugIndex.set(p.slug, p)
    // Also index by title for friendlier wikilinks
    const titleIndex = new Map<string, WikiPage>()
    for (const p of pages) titleIndex.set(p.frontmatter.title.toLowerCase(), p)

    // First pass: collect outbound links from each page
    const outbound = new Map<string, Set<string>>() // slug → set of target slugs
    const inbound = new Map<string, Set<string>>()  // slug → set of source slugs

    for (const p of pages) {
      const links = extractWikilinks(p.rawContent)
      const targets = new Set<string>()
      for (const link of links) {
        // Resolve: try slug first, then title
        let target = slugIndex.get(link)
        if (!target) target = titleIndex.get(link.toLowerCase())
        if (target) {
          targets.add(target.slug)
          if (!inbound.has(target.slug)) inbound.set(target.slug, new Set())
          inbound.get(target.slug)!.add(p.slug)
        }
      }
      outbound.set(p.slug, targets)
    }

    // Second pass: update each page's frontmatter with backlinks
    let updatedCount = 0
    for (const p of pages) {
      const backlinks = inbound.get(p.slug) ?? new Set<string>()
      const existingRelated = new Set(p.frontmatter.related)
      for (const b of backlinks) existingRelated.add(b)
      const newRelated = Array.from(existingRelated).sort()
      if (JSON.stringify(newRelated) !== JSON.stringify(p.frontmatter.related)) {
        await writeWikiPage(p.frontmatter.type as any, p.slug, {
          ...p.frontmatter,
          related: newRelated
        }, p.body)
        updatedCount++
      }
    }

    // Build MOC index pages
    await buildMOCs(pages)

    // Materialize graph
    const graph = {
      nodes: pages.map(p => ({ slug: p.slug, title: p.frontmatter.title, type: p.frontmatter.type, compiled: p.compiled })),
      edges: Array.from(outbound.entries()).flatMap(([src, targets]) =>
        Array.from(targets).map(tgt => ({ source: src, target: tgt }))
      ),
      generatedAt: new Date().toISOString()
    }
    await fs.mkdir(META_DIR, { recursive: true })
    await fs.writeFile(path.join(META_DIR, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8')

    await updateManifest('link')
    return NextResponse.json({
      ok: true,
      pagesScanned: pages.length,
      pagesUpdated: updatedCount,
      totalLinks: graph.edges.length,
      message: `Link pass complete. ${updatedCount} page(s) updated with backlinks. MOCs regenerated.`
    })
  } catch (err) {
    return NextResponse.json({ error: 'Link failed', detail: String(err) }, { status: 500 })
  }
}

async function buildMOCs(pages: WikiPage[]) {
  // Root README — all pages by type
  const byType: Record<string, WikiPage[]> = {}
  for (const p of pages) {
    const t = p.frontmatter.type
    if (!byType[t]) byType[t] = []
    byType[t].push(p)
  }
  const readmeBody = `# Second Brain — Root Index

*Last updated: ${new Date().toISOString()}*

This is the root Map of Content (MOC) for JARVIS's compiled knowledge base. Every wiki page is listed here, organized by type.

## Contents

${Object.entries(byType).map(([type, ps]) =>
  `### ${type.charAt(0).toUpperCase() + type.slice(1)} (${ps.length})\n\n${ps.map(p =>
    `- [[${p.slug}]] — ${p.frontmatter.title}${p.compiled ? '' : ' *(stub)*'}`
  ).join('\n')}`
).join('\n\n')}

## Statistics

- Total pages: ${pages.length}
- Compiled: ${pages.filter(p => p.compiled).length}
- Stubs awaiting compilation: ${pages.filter(p => !p.compiled).length}
- Total words: ${pages.reduce((s, p) => s + p.wordCount, 0).toLocaleString()}
`
  await writeWikiPage('indexes', 'README', {
    title: 'Second Brain Root Index',
    type: 'indexes',
    tags: ['moc', 'index'],
    related: [],
    sources: [],
    compiled_at: new Date().toISOString(),
    compiled_by: 'jarvis-link',
    raw_source: null,
    staleness_days: 0
  }, readmeBody)

  // by-topic.md — pages grouped by tag
  const byTag: Record<string, WikiPage[]> = {}
  for (const p of pages) {
    for (const tag of p.frontmatter.tags) {
      if (!byTag[tag]) byTag[tag] = []
      byTag[tag].push(p)
    }
  }
  const topicBody = `# Index — By Topic

*Last updated: ${new Date().toISOString()}*

${Object.entries(byTag).sort(([a], [b]) => a.localeCompare(b)).map(([tag, ps]) =>
  `## ${tag} (${ps.length})\n\n${ps.map(p => `- [[${p.slug}]] — ${p.frontmatter.title}`).join('\n')}`
).join('\n\n')}
`
  await writeWikiPage('indexes', 'by-topic', {
    title: 'Index — By Topic',
    type: 'indexes',
    tags: ['moc', 'index', 'topic'],
    related: ['README'],
    sources: [],
    compiled_at: new Date().toISOString(),
    compiled_by: 'jarvis-link',
    raw_source: null,
    staleness_days: 0
  }, topicBody)
}
