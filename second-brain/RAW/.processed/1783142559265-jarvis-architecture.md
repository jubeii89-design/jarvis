# JARVIS Architecture Overview

Source: System architecture documentation
Added: 2026-07-04T00:00:00Z

---

JARVIS (Just A Rather Very Intelligent System) is an advanced AI assistant modeled on the Marvel Cinematic Universe character. The system combines five horizontal layers: User input, the Brain (LLM reasoning), the Memory subsystem (five tiers), the Hands (web research), and the Voice (TTS output).

## Core Pillars

1. **The Brain** — LLM reasoning core powered by Anthropic Claude (with z-ai SDK fallback). Encodes the JARVIS persona via a system prompt specifying formal British register, dry deadpan wit, proactive helpfulness, and unwavering loyalty.

2. **The Memory** — A 5-tier cognitive architecture inspired by human information processing:
   - Tier 1: Sensory Buffer (volatile, 8 entries, ~5s horizon)
   - Tier 2: Short-Term Memory (24-turn conversation window with relevance decay)
   - Tier 3: Episodic Memory (long-term vector log with cosine similarity recall)
   - Tier 4: Semantic Memory (knowledge graph of entities and relations)
   - Tier 5: Compiled Wiki (Karpathy Second Brain — this knowledge base)

3. **The Hands** — Web research pipeline wrapping web_search and page_reader functions. The brain's router auto-detects when fresh information is needed.

4. **The Voice** — ElevenLabs TTS with a cloned Paul Bettany timbre. Falls back to z-ai TTS when unconfigured.

5. **The Personality** — Six pillars: formal British register, dry deadpan wit, unflappable calm, proactive helpfulness, gentle pushback, genuine warmth.

## Technology Stack

- Next.js 16 with TypeScript 5
- Tailwind CSS 4 with shadcn/ui
- Prisma ORM with SQLite
- z-ai-web-dev-sdk for LLM, TTS, and web search
- @anthropic-ai/sdk for direct Claude API access
- ReportLab for PDF generation
- Zustand for client state

## Key Design Decisions

- All external dependencies (LLM, TTS, embeddings) are isolated behind single-function seams for drop-in replacement
- The personality prompt is the highest-leverage artefact — its precision determines character fidelity
- Memory tiers are fetched in parallel for low-latency recall
- The Second Brain separates compile-time knowledge synthesis from query-time retrieval
