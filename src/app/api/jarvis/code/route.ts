/**
 * /api/jarvis/code
 * ───────────────────────────────────────────────────────────────────────────
 * Agentic coding via Claude Code CLI. Enabled when CLAUDE_CODE_ENABLED=true.
 *
 * POST → invokes `claude -p "<prompt>"` in the project directory.
 *        Requires a confirmed `confirmed: true` field in the request body
 *        to enforce the JARVIS permission flow ("Shall I proceed, sir?").
 *
 * GET  → reports CLI availability, authentication status, and whether
 *        agentic coding is enabled. Used by the UI's Claude Code panel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { access, constants } from 'fs/promises'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const maxDuration = 120

const PROJECT_DIR = '/home/z/my-project'

interface CodeRequestBody {
  prompt: string
  confirmed?: boolean
  cwd?: string
  timeout?: number
}

/**
 * Check whether the claude CLI is installed and on PATH.
 */
async function findClaudeBinary(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', ['claude'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * Detect auth status by running a trivial claude invocation.
 * Returns 'ok' | 'unauthenticated' | 'blocked' | 'unknown' | 'not_installed'
 *
 * We use a very short timeout (8s) because if Anthropic's API is geofencing
 * the region, the CLI will hang retrying. The 403 response is returned
 * quickly but the CLI's retry loop can make it appear to hang.
 */
async function probeClaudeAuth(): Promise<{ status: string; detail: string }> {
  const binary = await findClaudeBinary()
  if (!binary) return { status: 'not_installed', detail: 'claude CLI not found on PATH' }

  try {
    const { stdout: versionOut } = await execFileAsync(binary, ['--version'], { timeout: 5000 })
    const version = versionOut.trim()

    // First: check if ANTHROPIC_API_KEY is in env. If not, the CLI needs OAuth.
    if (!process.env.ANTHROPIC_API_KEY) {
      return { status: 'unauthenticated', detail: `CLI ${version} installed but no ANTHROPIC_API_KEY — run 'claude login'` }
    }

    // Quick probe: do a direct API ping (faster than the CLI which has retry loops)
    try {
      const probeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'OK' }]
        }),
        signal: AbortSignal.timeout(8000)
      })

      if (probeResp.ok) {
        return { status: 'ok', detail: `CLI ${version} ready · API key valid and region supported` }
      }
      if (probeResp.status === 403) {
        return { status: 'blocked', detail: `CLI ${version} installed but Anthropic API returned 403 (regional geofence)` }
      }
      if (probeResp.status === 401) {
        return { status: 'unauthenticated', detail: `CLI ${version} installed but API key rejected (401)` }
      }
      return { status: 'unknown', detail: `CLI ${version} installed · API returned ${probeResp.status}` }
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('abort') || msg.includes('timeout') || msg.includes('Timeout')) {
        return { status: 'blocked', detail: `CLI ${version} installed but API probe timed out (likely regional geofence or network issue)` }
      }
      return { status: 'unknown', detail: `CLI ${version} installed · API probe failed: ${msg.slice(0, 100)}` }
    }
  } catch {
    return { status: 'not_installed', detail: 'claude CLI not executable' }
  }
}

export async function GET() {
  const enabled = process.env.CLAUDE_CODE_ENABLED === 'true'
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY
  const binary = await findClaudeBinary()
  const auth = enabled ? await probeClaudeAuth() : { status: 'disabled', detail: 'CLAUDE_CODE_ENABLED is not true' }

  return NextResponse.json({
    enabled,
    anthropicConfigured,
    cliInstalled: !!binary,
    cliPath: binary,
    authStatus: auth.status,
    authDetail: auth.detail,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
    summary: enabled
      ? (binary
          ? (auth.status === 'ok'
              ? `Claude Code CLI ready · ${auth.detail}`
              : `CLI installed but ${auth.status}: ${auth.detail}`)
          : 'CLAUDE_CODE_ENABLED=true but claude CLI not installed. Run: npm install -g @anthropic-ai/claude-code')
      : 'Agentic coding disabled. Set CLAUDE_CODE_ENABLED=true to enable.'
  })
}

export async function POST(req: NextRequest) {
  const enabled = process.env.CLAUDE_CODE_ENABLED === 'true'
  if (!enabled) {
    return NextResponse.json({
      error: 'Agentic coding is disabled',
      detail: 'Set CLAUDE_CODE_ENABLED=true in .env to enable JARVIS to invoke the Claude Code CLI.',
      hint: 'JARVIS will continue to reason with the chat brain; only agentic shell/file operations are gated by this flag.'
    }, { status: 403 })
  }

  const body = (await req.json()) as CodeRequestBody
  if (!body.prompt || typeof body.prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  // Permission gate — JARVIS must ask before executing agentic commands.
  // The frontend renders the permission dialog; only after the user clicks
  // "Allow" does it re-POST with confirmed: true.
  if (!body.confirmed) {
    return NextResponse.json({
      permissionRequired: true,
      message: `Sir, I wish to invoke Claude Code with the following prompt. This will execute agentic commands on your machine. Shall I proceed?`,
      prompt: body.prompt,
      cwd: body.cwd ?? PROJECT_DIR
    }, { status: 202 })
  }

  const binary = await findClaudeBinary()
  if (!binary) {
    return NextResponse.json({
      error: 'Claude Code CLI not installed',
      detail: 'Install it with: npm install -g @anthropic-ai/claude-code',
      hint: 'JARVIS is ready to invoke it once installed.'
    }, { status: 503 })
  }

  // Pre-flight: check the API is reachable before invoking the CLI.
  // The CLI will hang on retry if the API is geofenced, so we probe first.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const preflight = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'OK' }]
        }),
        signal: AbortSignal.timeout(8000)
      })
      if (preflight.status === 403) {
        return NextResponse.json({
          error: 'Anthropic API blocked (regional geofence)',
          detail: 'The Anthropic API returned HTTP 403 "Request not allowed" from this region.',
          blocked: true,
          hint: 'Deploy JARVIS in an Anthropic-supported region, or route the server through a proxy in a supported region. JARVIS continues to function via the z-ai SDK fallback brain.'
        }, { status: 451 })
      }
      if (preflight.status === 401) {
        return NextResponse.json({
          error: 'Anthropic API key rejected',
          detail: 'The API key was rejected (401). Verify the key is active in console.anthropic.com.',
          hint: 'Generate a new key and update ANTHROPIC_API_KEY in .env.'
        }, { status: 401 })
      }
    } catch {
      // Network error on preflight — let the CLI try, but it will likely fail
    }
  }

  const cwd = body.cwd && body.cwd.startsWith('/') ? body.cwd : PROJECT_DIR
  const timeout = Math.min(body.timeout ?? 60000, 90000)

  try {
    const { stdout, stderr } = await execFileAsync(
      binary,
      ['-p', body.prompt, '--output-format', 'text', '--max-turns', '5'],
      { timeout, cwd, env: process.env, maxBuffer: 1024 * 1024 * 4 }
    )

    return NextResponse.json({
      ok: true,
      output: stdout.trim(),
      stderr: stderr.trim() || null,
      cwd,
      prompt: body.prompt
    })
  } catch (err: any) {
    const stderr = err.stderr || err.message || ''
    const isBlocked = stderr.includes('forbidden') || stderr.includes('Request not allowed') || stderr.includes('403')
    return NextResponse.json({
      error: isBlocked ? 'Anthropic API blocked (regional geofence)' : 'Claude Code invocation failed',
      detail: stderr.slice(0, 500),
      blocked: isBlocked,
      hint: isBlocked
        ? 'The Anthropic API is rejecting requests from this region. Deploy JARVIS in an Anthropic-supported region, or route traffic through a proxy in a supported region.'
        : undefined
    }, { status: isBlocked ? 451 : 500 })
  }
}
