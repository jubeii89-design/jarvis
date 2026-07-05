/**
 * POST /api/jarvis/second-brain/lint
 * ───────────────────────────────────────────────────────────────────────────
 * Health checks across the wiki:
 *   - gaps:       concepts referenced via [[wikilinks]] but not yet written
 *   - stale:      compiled pages older than 30 days
 *   - brokenLinks: [[wikilinks]] pointing to non-existent pages
 *   - orphans:    pages with no inbound links (knowledge islands)
 *
 * Writes reports to .lint/ and a summary.json. Returns the summary so
 * JARVIS can surface it in chat: "Sir, I've identified 3 knowledge gaps..."
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import {
  listWikiPages, extractWikilinks, ensureDirs, LINT_DIR, META_DIR,
  updateManifest, WikiPage
} from '@/lib/jarvis/second-brain'

export const runtime = 'nodejs'
export const maxDuration = 60

const STALE_THRESHOLD_DAYS = 30

interface LintReport {
  gaps: Array<{ referencedAs: string; referencedBy: string[] }>
  stale: Array<{ slug: string; title: string; daysOld: number; compiledAt: string }>
  brokenLinks: Array<{ from: string; target: string }>
  orphans: Array<{ slug: string; title: string; type: string }>
}

export async function POST() {
  try {
    await ensureDirs()
    await fs.mkdir(LINT_DIR, { recursive: true })
    const pages = await listWikiPages()

    // Build indexes
    const slugIndex = new Map<string, WikiPage>()
    const titleIndex = new Map<string, WikiPage>()
    for (const p of pages) {
      slugIndex.set(p.slug, p)
      titleIndex.set(p.frontmatter.title.toLowerCase(), p)
    }

    // Collect all wikilinks and their sources
    const linkSources = new Map<string, Set<string>>() // target → set of source slugs
    const allOutbound = new Map<string, string[]>()    // source → array of raw link texts

    for (const p of pages) {
      const links = extractWikilinks(p.rawContent)
      allOutbound.set(p.slug, links)
      for (const link of links) {
        if (!linkSources.has(link)) linkSources.set(link, new Set())
        linkSources.get(link)!.add(p.slug)
      }
    }

    // Gaps: wikilinks that don't resolve to any page
    const gaps: LintReport['gaps'] = []
    for (const [link, sources] of linkSources) {
      if (!slugIndex.has(link) && !titleIndex.has(link.toLowerCase())) {
        gaps.push({ referencedAs: link, referencedBy: Array.from(sources) })
      }
    }

    // Stale: compiled pages older than threshold
    const stale: LintReport['stale'] = []
    const now = Date.now()
    for (const p of pages) {
      if (!p.compiled || !p.frontmatter.compiled_at) continue
      const compiledAt = new Date(p.frontmatter.compiled_at).getTime()
      const daysOld = Math.floor((now - compiledAt) / (1000 * 60 * 60 * 24))
      if (daysOld >= STALE_THRESHOLD_DAYS) {
        stale.push({ slug: p.slug, title: p.frontmatter.title, daysOld, compiledAt: p.frontmatter.compiled_at })
      }
    }

    // Broken links: same as gaps but from the source page's perspective
    const brokenLinks: LintReport['brokenLinks'] = []
    for (const [srcSlug, links] of allOutbound) {
      for (const link of links) {
        if (!slugIndex.has(link) && !titleIndex.has(link.toLowerCase())) {
          brokenLinks.push({ from: srcSlug, target: link })
        }
      }
    }

    // Orphans: pages with no inbound links (excluding indexes)
    const inboundCount = new Map<string, number>()
    for (const p of pages) inboundCount.set(p.slug, 0)
    for (const [link, sources] of linkSources) {
      const target = slugIndex.get(link) ?? titleIndex.get(link.toLowerCase())
      if (target) {
        inboundCount.set(target.slug, (inboundCount.get(target.slug) ?? 0) + sources.size)
      }
    }
    const orphans: LintReport['orphans'] = []
    for (const p of pages) {
      if (p.frontmatter.type === 'indexes') continue
      if ((inboundCount.get(p.slug) ?? 0) === 0) {
        orphans.push({ slug: p.slug, title: p.frontmatter.title, type: p.frontmatter.type })
      }
    }

    const report: LintReport = { gaps, stale, brokenLinks, orphans }

    // Write detailed reports
    await fs.writeFile(path.join(LINT_DIR, 'gaps.md'),
      `# Knowledge Gaps\n\nWikilinks that reference pages which don't yet exist. These are compilation candidates.\n\n` +
      (gaps.length ? gaps.map(g => `## [[${g.referencedAs}]]\n\nReferenced by:\n${g.referencedBy.map(s => `- [[${s}]]`).join('\n')}`).join('\n\n') : '*No gaps found.*'),
      'utf8')

    await fs.writeFile(path.join(LINT_DIR, 'stale.md'),
      `# Stale Pages\n\nCompiled pages older than ${STALE_THRESHOLD_DAYS} days that may need refreshing.\n\n` +
      (stale.length ? stale.map(s => `- [[${s.slug}]] — ${s.title} (${s.daysOld} days old, compiled ${s.compiledAt})`).join('\n') : '*No stale pages.*'),
      'utf8')

    await fs.writeFile(path.join(LINT_DIR, 'broken-links.md'),
      `# Broken Links\n\nWikilinks pointing to non-existent pages.\n\n` +
      (brokenLinks.length ? brokenLinks.map(b => `- From [[${b.from}]] → [[${b.target}]]`).join('\n') : '*No broken links.*'),
      'utf8')

    await fs.writeFile(path.join(LINT_DIR, 'orphans.md'),
      `# Orphan Pages\n\nPages with no inbound links — knowledge islands.\n\n` +
      (orphans.length ? orphans.map(o => `- [[${o.slug}]] — ${o.title} (${o.type})`).join('\n') : '*No orphan pages.*'),
      'utf8')

    // Summary
    const summary = {
      gaps: gaps.length,
      stale: stale.length,
      brokenLinks: brokenLinks.length,
      orphans: orphans.length,
      generatedAt: new Date().toISOString()
    }
    await fs.writeFile(path.join(LINT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

    await updateManifest('lint')
    return NextResponse.json({
      ok: true,
      summary,
      details: report,
      message: `Lint complete. ${gaps.length} gap(s), ${stale.length} stale page(s), ${brokenLinks.length} broken link(s), ${orphans.length} orphan page(s).`
    })
  } catch (err) {
    return NextResponse.json({ error: 'Lint failed', detail: String(err) }, { status: 500 })
  }
}
