# The 4-Tier Memory Architecture

Source: JARVIS system documentation
Added: 2026-07-04T00:00:00Z

---

JARVIS's memory subsystem is modeled on human information processing theory, specifically the Atkinson-Shiffrin multi-store model (1968) and Tulving's distinction between episodic and semantic long-term memory (1972).

## Tier 1 — Sensory Buffer

- **Horizon**: ~5 seconds
- **Capacity**: 8 entries
- **Mechanism**: Volatile in-process LRU per session. Mirrors human iconic memory.
- **Implementation**: Map<sessionId, Entry[]> in process memory. Lost on restart — by design.
- **Purpose**: Provides the brain with the most recent few seconds of context for disambiguation ("that", "it", "the thing you just mentioned").

## Tier 2 — Short-Term Memory

- **Horizon**: Current conversation
- **Capacity**: 24 turns
- **Mechanism**: Bounded queue with relevance decay (x0.95 per turn over capacity).
- **Implementation**: Prisma ShortTermMemory model. Sliding window of last N messages.
- **Purpose**: The active conversation window — always injected into the brain's context.

## Tier 3 — Episodic Memory

- **Horizon**: Permanent (until pruned by importance)
- **Capacity**: Unbounded
- **Mechanism**: Vector log of episodes. Semantic similarity recall via cosine distance.
- **Implementation**: Prisma EpisodicMemory with JSON-encoded embedding. Trigram-hash (384-dim) in sandbox; real embedding model in production.
- **Purpose**: Long-term recall of past interactions. Each episode = one meaningful exchange with text summary, embedding, tags, and importance score.

## Tier 4 — Semantic Memory

- **Horizon**: Permanent
- **Capacity**: Unbounded
- **Mechanism**: Knowledge graph: typed entities + relations. Structured world model.
- **Implementation**: Prisma Entity + EntityRelation models. Swap for Neo4j / TigerGraph at scale.
- **Purpose**: JARVIS's structured world model — people, places, concepts, projects, and their relationships.

## Tier 5 — Compiled Wiki (Second Brain)

- **Horizon**: Permanent
- **Capacity**: Unbounded
- **Mechanism**: Karpathy-style compiled knowledge base. Markdown files on disk, compiled by the brain from raw input.
- **Implementation**: /second-brain/wiki/ folder with frontmatter metadata. Compile-time synthesis (vs query-time RAG).
- **Purpose**: Compounding knowledge. The wiki page already contains the synthesis — no need to re-retrieve and re-synthesize raw snippets at query time.

## Cognitive Science Basis

- Atkinson-Shiffrin model (1968): sensory → short-term → long-term stores
- Tulving (1972): episodic vs semantic distinction within long-term memory
- The 5th tier (compiled wiki) is an engineering extension — humans do this via note-taking and reflection

## Recall Flow

1. Check Tier 5 (compiled wiki) first — is there a wiki page? Read the synthesis.
2. If no wiki page, fall back to Tier 3 (episodic vector recall) for raw snippets.
3. Tier 4 (semantic graph) provides entity context.
4. Tier 2 (short-term) always injected.
5. Tier 1 (sensory) available for disambiguation.

All tiers are fetched in parallel via buildRecallBundle() — total recall latency is bounded by the slowest tier.
