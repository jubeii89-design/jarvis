/**
 * POST /api/jarvis/second-brain/ingest
 * ───────────────────────────────────────────────────────────────────────────
 * Reads all unprocessed files in RAW/, creates stub wiki pages with metadata.
 * Stubs have compiled_by: 'jarvis-stub' — they contain the raw text in a
 * structured wrapper, ready for Claude to enrich during compilation.
 *
 * Stubs are immediately useful: JARVIS can query them via the wiki-lookup
 * path in synthesizeReply(), giving you Second Brain benefits even before
 * Claude compilation runs.
 *
 * Body (optional): { rawPath?: string } — ingest a single file, or all if omitted
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import {
  listRawFiles, writeWikiPage, moveRawToProcessed, slugify,
  ensureDirs, listWikiPages, updateManifest, WikiType
} from '@/lib/jarvis/second-brain'

export const runtime = 'nodejs'
export const maxDuration = 60

interface IngestResult {
  ingested: Array<{ file: string; wikiPage: string; type: string; title: string }>
  skipped: Array<{ file: string; reason: string }>
}

export async function POST(req: NextRequest) {
  try {
    await ensureDirs()
    const body = await req.json().catch(() => ({}))
    const targetPath = body.rawPath as string | undefined

    const rawFiles = await listRawFiles()
    const filtered = targetPath ? rawFiles.filter(f => f.path === targetPath) : rawFiles

    if (filtered.length === 0) {
      return NextResponse.json({
        ingested: [],
        skipped: [],
        message: 'No raw files to ingest. Drop files in second-brain/RAW/ or POST to /api/jarvis/second-brain to add content.'
      })
    }

    const existingPages = await listWikiPages()
    const existingSlugs = new Set(existingPages.map(p => p.slug))

    const result: IngestResult = { ingested: [], skipped: [] }

    for (const raw of filtered) {
      try {
        const content = await fs.readFile(raw.path, 'utf8')
        // Extract title from first H1 or filename
        const titleMatch = content.match(/^#\s+(.+)$/m)
        const title = titleMatch ? titleMatch[1].trim() : path.basename(raw.path, path.extname(raw.path))
        const slug = slugify(title)

        if (existingSlugs.has(slug)) {
          result.skipped.push({ file: raw.relativePath, reason: `Wiki page "${slug}" already exists` })
          continue
        }

        // Guess the wiki type from the raw type
        const wikiType: WikiType =
          raw.type === 'transcripts' ? 'events' :
          raw.type === 'pdfs' ? 'concepts' :
          'concepts'

        // Build stub body — structured wrapper around raw content
        const stubBody = `## Summary

*(Awaiting compilation — this is a stub page created from raw ingestion. Run the compile operation to have Claude synthesize a proper summary, extract key facts, and build cross-references.)*

## Raw Content

${content}

## Open Questions

- What are the key entities mentioned in this content?
- How does this connect to existing knowledge?
- What follow-up research would deepen understanding?
`

        const wikiPath = await writeWikiPage(wikiType, slug, {
          title,
          type: wikiType,
          tags: ['uncompiled', raw.type],
          related: [],
          sources: [raw.relativePath],
          compiled_at: null,
          compiled_by: 'jarvis-stub',
          raw_source: raw.relativePath,
          staleness_days: null
        }, stubBody)

        // Move raw file to processed
        await moveRawToProcessed(raw.path)
        result.ingested.push({
          file: raw.relativePath,
          wikiPage: `wiki/${wikiType}/${slug}.md`,
          type: wikiType,
          title
        })
      } catch (err) {
        result.skipped.push({ file: raw.relativePath, reason: String(err) })
      }
    }

    await updateManifest('ingest')
    return NextResponse.json({
      ok: true,
      ...result,
      message: result.ingested.length
        ? `Ingested ${result.ingested.length} file(s) into wiki stubs. Run compile to enrich with Claude.`
        : 'No new files ingested.'
    })
  } catch (err) {
    return NextResponse.json({ error: 'Ingest failed', detail: String(err) }, { status: 500 })
  }
}
