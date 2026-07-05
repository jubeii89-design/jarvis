/**
 * GET /api/jarvis/second-brain
 * Returns the full status of the second brain: file counts, compiled pages,
 * stub pages, last compile time, lint summary.
 *
 * POST /api/jarvis/second-brain
 * Add raw content directly. Body: { type: 'note'|'article'|'transcript', title, content }
 * Creates a file in RAW/<type>s/ ready for ingestion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getStatus, ensureDirs, RAW_DIR, slugify } from '@/lib/jarvis/second-brain'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const status = await getStatus()
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to get status', detail: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, title, content } = await req.json()
    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }
    const validTypes = ['note', 'article', 'transcript']
    const t = validTypes.includes(type) ? type : 'note'
    const subdir = t === 'note' ? 'notes' : t === 'article' ? 'articles' : 'transcripts'
    await ensureDirs()
    const dir = path.join(RAW_DIR, subdir)
    const slug = slugify(title)
    const filename = `${Date.now()}-${slug}.md`
    const fullPath = path.join(dir, filename)
    const fileContent = `# ${title}\n\nSource: JARVIS UI direct input\nAdded: ${new Date().toISOString()}\n\n---\n\n${content}`
    await fs.writeFile(fullPath, fileContent, 'utf8')
    return NextResponse.json({ ok: true, path: fullPath, filename, message: `Added to RAW/${subdir}/${filename}. Run ingest to create a wiki stub, then compile to enrich.` })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to add raw content', detail: String(err) }, { status: 500 })
  }
}
