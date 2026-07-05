/**
 * GET /api/jarvis/blueprint-pdf
 * Serves the pre-generated JARVIS Architecture Blueprint PDF.
 * If the file doesn't exist, it invokes the Python generator script.
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, access } from 'fs/promises'

const execAsync = promisify(exec)
const PDF_PATH = '/home/z/my-project/download/JARVIS_Architecture_Blueprint.pdf'
const SCRIPT_PATH = '/home/z/my-project/scripts/generate_jarvis_pdf.py'

export const runtime = 'nodejs'
export const maxDuration = 60

async function ensurePdfExists() {
  try {
    await access(PDF_PATH)
    return true
  } catch {
    // File doesn't exist — generate it
    try {
      await execAsync(`python3 ${SCRIPT_PATH}`, { timeout: 30000 })
      return true
    } catch (err) {
      console.error('PDF generation failed:', err)
      return false
    }
  }
}

export async function GET() {
  const exists = await ensurePdfExists()
  if (!exists) {
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
  const buffer = await readFile(PDF_PATH)
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="JARVIS_Architecture_Blueprint.pdf"',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
