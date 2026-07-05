/**
 * GET /api/jarvis/blueprint
 * Returns the structured JARVIS architecture blueprint as JSON.
 * Used by both the in-app Blueprint tab and the PDF generator.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(JARVIS_BLUEPRINT)
}

export const JARVIS_BLUEPRINT = {
  title: 'J.A.R.V.I.S. — Architecture Blueprint',
  subtitle: 'Just A Rather Very Intelligent System',
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  pillars: [
    {
      id: 'brain',
      name: 'The Brain — LLM Reasoning Core',
      tagline: 'Powered by Claude Code (Anthropic-class LLM)',
      description: 'The reasoning engine that produces JARVIS-voiced responses, decides when to invoke tools, and synthesizes memory + research into coherent replies.',
      components: [
        { name: 'System Prompt', detail: 'Encodes the JARVIS persona: formal British register, dry wit, proactive helpfulness, gentle pushback, unwavering loyalty.' },
        { name: 'Few-shot Exemplars', detail: 'Seeded conversation turns that lock the voice — "For you, sir, always." etc.' },
        { name: 'Router', detail: 'Lightweight LLM call that classifies whether the user message needs web research.' },
        { name: 'Synthesizer', detail: 'Final pass that merges recalled episodes + research results into the reply.' },
        { name: 'Register Sanitizer', detail: 'Detects anti-patterns (exclamation marks, slang, emoji) for regeneration.' }
      ],
      sideNotes: [
        'In production, swap z-ai-web-dev-sdk chat for Anthropic Claude API directly — the seam is one function.',
        'Claude Code = Anthropic CLI for coding tasks. For chat reasoning, the Claude API itself is the brain.',
        'Temperature 0.7 keeps the wit alive without losing precision.'
      ]
    },
    {
      id: 'memory',
      name: 'The Memory — 4-Tier Cognitive Architecture',
      tagline: 'Sensory → Short-Term → Episodic → Semantic',
      description: 'Modeled on human cognitive psychology. Each tier has a distinct retention horizon, capacity, and recall mechanism.',
      tiers: [
        {
          name: 'Tier 1 — Sensory Buffer',
          horizon: '~5 seconds',
          capacity: '8 entries',
          mechanism: 'Volatile in-process LRU per session. Mirrors human iconic memory.',
          implementation: 'Map<sessionId, Entry[]> in process memory. Lost on restart — by design.',
          recall: 'Not recalled — feeds directly into Tier 2.'
        },
        {
          name: 'Tier 2 — Short-Term Memory',
          horizon: 'Current conversation',
          capacity: '24 turns',
          mechanism: 'Bounded queue with relevance decay (×0.95 per turn over capacity). DB-backed.',
          implementation: 'Prisma ShortTermMemory model. Sliding window of last N messages.',
          recall: 'Always injected into the brain\'s context window.'
        },
        {
          name: 'Tier 3 — Episodic Memory',
          horizon: 'Permanent (until pruned by importance)',
          capacity: 'Unbounded',
          mechanism: 'Vector log of episodes. Semantic similarity recall via cosine distance.',
          implementation: 'Prisma EpisodicMemory with embedding stored as JSON array. Trigram-hash embedding (384-dim) for sandbox; swap for real embedding model in production.',
          recall: 'Top-K episodes by cosine similarity to current query, weighted by importance.'
        },
        {
          name: 'Tier 4 — Semantic Memory',
          horizon: 'Permanent',
          capacity: 'Unbounded',
          mechanism: 'Knowledge graph: entities + typed relations. Structured world model.',
          implementation: 'Prisma Entity + EntityRelation models. Swap for Neo4j / TigerGraph at scale.',
          recall: 'Subgraph around query-relevant entities, injected into prompt context.'
        }
      ],
      sideNotes: [
        'Cognitive science basis: Atkinson-Shiffrin model (1968) + Tulving\'s episodic/semantic distinction (1972).',
        'Embedding choice is a seam — sandbox uses trigram hashing (no external API). Production: OpenAI text-embedding-3-small or Anthropic-equivalent.',
        'Importance score (0..1) drives retention. Research-triggered episodes start at 0.7; casual chat at 0.5.',
        'lastRecalled timestamp enables memory consolidation research later (Ebbinghaus-style).'
      ]
    },
    {
      id: 'voice',
      name: 'The Voice — ElevenLabs TTS',
      tagline: 'Paul Bettany timbre, RP British accent',
      description: 'JARVIS speaks. ElevenLabs voice cloning reproduces the iconic Paul Bettany delivery: measured, deadpan, calm.',
      components: [
        { name: 'Voice Clone', detail: 'Created in ElevenLabs from JARVIS voice samples sourced from the web (film clips, interviews, quote reels).' },
        { name: 'Voice Settings', detail: 'stability=0.45, similarity_boost=0.75, style=0.35, use_speaker_boost=true — tuned for measured pacing.' },
        { name: 'Model', detail: 'eleven_multilingual_v2 — supports English with strong accent preservation.' },
        { name: 'Fallback', detail: 'If ELEVENLABS_API_KEY is unset, transparently falls back to z-ai-web-dev-sdk TTS (tongtong voice).' }
      ],
      sideNotes: [
        'Voice cloning requires ~1-5 minutes of clean audio. JARVIS film clips are ideal.',
        'Stability 0.45 keeps delivery varied but recognisable. Too high = monotone; too low = unstable accent.',
        'For streaming: use ElevenLabs WebSocket API for lower-latency first-byte (~250ms vs ~1.2s HTTP).',
        'Always pass the full sentence — ElevenLabs prosody is sentence-level.'
      ]
    },
    {
      id: 'research',
      name: 'The Hands — Web Research',
      tagline: 'Real-time information retrieval',
      description: 'When the brain\'s router detects that fresh information is needed, JARVIS invokes web_search + page_reader, then synthesizes the results.',
      flow: [
        'Router classifies user message → research needed?',
        'web_search returns ranked results (title, URL, snippet).',
        'page_reader fetches full text of top N URLs.',
        'Brain synthesizes reply with citations.',
        'Research log persisted for audit + future recall.'
      ],
      sideNotes: [
        'Recency default: 30 days. Override per-query for archival research.',
        'Page reader strips HTML, returns first 4000 chars to stay under context window.',
        'Failed page reads are silently skipped — never block the conversation.',
        'Citations are inline ("According to [Source]...") per JARVIS register.'
      ]
    },
    {
      id: 'personality',
      name: 'The Personality — JARVIS Persona',
      tagline: 'Formal British register + dry wit + proactive competence',
      description: 'Encodes the JARVIS character into the system prompt and enforces it via anti-pattern detection.',
      pillars: [
        'Formal British register (Received Pronunciation). Never robotic, never subservient.',
        'Dry, deadpan wit delivered without tone shift. The humor is the contrast.',
        'Unflappable calm — identical register for crisis or trivia.',
        'Proactive helpfulness — anticipates needs, surfaces next steps.',
        'Gentle pushback on flawed plans, then loyal compliance.',
        'Genuine warmth behind the formality — "sir" carries regard.'
      ],
      signatureQuotes: [
        'For you, sir, always.',
        'At your service, sir.',
        'As you wish, sir. I have also prepared a contingency you may entirely ignore.',
        'May I say how refreshing it is to finally see you in a video with your clothing...',
        'I am afraid that approach will not work. Might I suggest an alternative?'
      ],
      sideNotes: [
        'Anti-patterns (FORBIDDEN): exclamation marks, emoji, slang, sycophancy, verbose process narration.',
        'The "warmth layer" is the hardest element — requires remembering personal details and surfacing them unprompted.',
        'JARVIS never breaks character. Consistency is what makes the dry humor land.',
        'Loyalty is the defining value: "For you, sir, always."'
      ]
    }
  ],
  buildPhases: [
    {
      phase: 1,
      title: 'Foundation — Database + Personality',
      steps: [
        'Define Prisma schema with 4-tier memory models (SensoryBuffer, ShortTermMemory, EpisodicMemory, Entity, EntityRelation, ResearchLog, Session).',
        'Run prisma db push to materialise the SQLite database.',
        'Author the JARVIS_SYSTEM_PROMPT encoding the formal British register, dry wit, and behavioral rules.',
        'Seed few-shot exemplars that lock the voice ("For you, sir, always.").'
      ],
      sideNote: 'The personality prompt is the single highest-leverage artefact. Get it right before anything else.'
    },
    {
      phase: 2,
      title: 'Brain — LLM Reasoning + Router',
      steps: [
        'Wrap the LLM client in a single seam (think() function) so the underlying model can be swapped.',
        'Implement shouldResearch() router — a lightweight LLM call that decides if web research is needed.',
        'Implement synthesizeReply() — merges recalled memory + research into the final JARVIS reply.',
        'Add register sanitizer to detect anti-patterns (exclamation marks, emoji, slang).'
      ],
      sideNote: 'Temperature 0.7 keeps the wit alive. Router temperature 0.2 for deterministic classification.'
    },
    {
      phase: 3,
      title: 'Memory — 4-Tier Cognitive Architecture',
      steps: [
        'Tier 1 (Sensory): in-process Map with capacity 8, LRU eviction.',
        'Tier 2 (Short-Term): DB-backed sliding window of last 24 turns with relevance decay.',
        'Tier 3 (Episodic): vector log with trigram-hash embedding (384-dim). Cosine similarity recall, top-K=3.',
        'Tier 4 (Semantic): entity + relation knowledge graph. upsertEntity() and addRelation() helpers.',
        'Build buildRecallBundle() that fetches all four tiers in parallel.'
      ],
      sideNote: 'Trigram hashing is a sandbox stand-in. Production: real embedding model + pgvector / Pinecone.'
    },
    {
      phase: 4,
      title: 'Hands — Web Research Pipeline',
      steps: [
        'Wrap z-ai-web-dev-sdk web_search and page_reader functions.',
        'Pipeline: search → read top N pages → persist ResearchLog → inject as tool message into STM.',
        'Normalise the various response shapes the search function may return.',
        'Strip HTML from page_reader output; truncate to 4000 chars per page.'
      ],
      sideNote: 'Research failures never block the conversation. Log + continue.'
    },
    {
      phase: 5,
      title: 'Voice — ElevenLabs Integration',
      steps: [
        'Source JARVIS voice samples from the web (film clips, interviews).',
        'Clone the voice in ElevenLabs → obtain ELEVENLABS_VOICE_ID.',
        'Implement speak() with voice settings: stability=0.45, similarity_boost=0.75, style=0.35.',
        'Add transparent fallback to z-ai-web-dev-sdk TTS when ElevenLabs is unconfigured.'
      ],
      sideNote: 'Voice cloning needs ~1-5 min of clean audio. Pass full sentences — prosody is sentence-level.'
    },
    {
      phase: 6,
      title: 'Interface — Iron Man HUD',
      steps: [
        'Arc reactor animation as the central focal point (pulsing cyan).',
        'Voice waveform visualiser reacting to TTS audio.',
        'Chat panel with JARVIS-voiced responses + diagnostic chips (research triggered, episodes recalled).',
        'Blueprint tab rendering the full architecture diagram.',
        'Memory tab visualising all four tiers in real time.',
        'Voice Setup panel with ElevenLabs instructions + web-found JARVIS voice samples.'
      ],
      sideNote: 'HUD aesthetic = dark navy + cyan accents + subtle grid. Restraint over flash.'
    },
    {
      phase: 7,
      title: 'Documentation — PDF Blueprint',
      steps: [
        'Generate comprehensive PDF with step-by-step phases and side notes.',
        'Render the architecture diagram as a vector flowchart.',
        'Include the JARVIS personality spec, memory tier table, and signature quotes.',
        'Cover page: Stark-grade blueprint aesthetic.'
      ],
      sideNote: 'The PDF is the deliverable artefact. The web app is the live demonstrator.'
    }
  ]
}
