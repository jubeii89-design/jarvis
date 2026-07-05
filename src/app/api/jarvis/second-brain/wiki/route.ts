/**
 * GET /api/jarvis/second-brain/wiki
 * Lists all wiki pages with metadata.
 *
 * GET /api/jarvis/second-brain/wiki?type=concepts  — filter by type
 * GET /api/jarvis/second-brain/wiki?slug=fusion-energy  — get a single page
 */

import { NextRequest, NextResponse } from 'next/server'
import { listWikiPages, readWikiPage, WikiType } from '@/lib/jarvis/second-brain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as WikiType | null
  const slug = searchParams.get('slug')

  try {
    if (slug) {
      // Get a single page — try all types
      const types: WikiType[] = ['concepts', 'people', 'projects', 'events', 'indexes']
      for (const t of types) {
        const page = await readWikiPage(t, slug)
        if (page) return NextResponse.json(page)
      }
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    let pages = await listWikiPages()
    if (type) pages = pages.filter(p => p.frontmatter.type === type)

    return NextResponse.json({
      count: pages.length,
      pages: pages.map(p => ({
        slug: p.slug,
        title: p.frontmatter.title,
        type: p.frontmatter.type,
        tags: p.frontmatter.tags,
        related: p.frontmatter.related,
        compiled: p.compiled,
        compiledAt: p.frontmatter.compiled_at,
        compiledBy: p.frontmatter.compiled_by,
        wordCount: p.wordCount,
        relativePath: p.relativePath
      }))
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list wiki', detail: String(err) }, { status: 500 })
  }
}
