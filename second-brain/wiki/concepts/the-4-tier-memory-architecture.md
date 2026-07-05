---
title: "The 4-Tier Memory Architecture"
type: concepts
tags: ["memory-architecture", "cognitive-science", "information-processing", "knowledge-management", "episodic-memory", "semantic-memory", "second-brain", "compiled"]
related: ["jarvis-architecture-overview", "jarvis-personality-spec", "nuclear-fusion-energy-breakthroughs-2025", "the-4-tier-memory-architecture"]
sources: ["RAW/notes/four-tier-memory.md"]
compiled_at: "2026-07-04T05:23:20.276Z"
compiled_by: "jarvis-brain"
raw_source: "RAW/notes/four-tier-memory.md"
staleness_days: 0
---


## Summary

The 4-Tier Memory Architecture is JARVIS's cognitive memory system modeled on human information processing theories, incorporating Atkinson-Shiffrin's multi-store model and Tulving's distinction between episodic and semantic memory. This architecture consists of five tiers: the Sensory Buffer (5-second volatile memory), Short-Term Memory (24-turn conversation window), Episodic Memory (permanent vector log of interactions), Semantic Memory (structured knowledge graph), and the Compiled Wiki (second brain with synthesized knowledge). The system operates on a recall flow that first checks the compiled wiki for synthesized information before falling back to raw episodic snippets, with all tiers accessed in parallel to optimize response latency. This architecture represents both a cognitive science foundation and an engineering extension through the note-taking compilation process.

## Key Facts

- The Sensory Buffer holds approximately 5 seconds of context with a capacity of 8 entries, implemented as volatile in-process LRU per session.
- Short-Term Memory maintains a bounded queue of 24 conversation turns with relevance decay (x0.95 per turn over capacity).
- Episodic Memory provides permanent long-term recall through a vector log system using semantic similarity matching via cosine distance.
- Semantic Memory functions as JARVIS's structured world model, containing typed entities and their relationships implemented as a knowledge graph.
- The Compiled Wiki (Second Brain) represents a Karpathy-style knowledge base where information is synthesized during compilation rather than retrieved at query time.
- The recall flow prioritizes the compiled wiki first, then falls back to episodic memory, semantic memory, and finally the sensory buffer for disambiguation.
- All memory tiers are accessed in parallel via buildRecallBundle() to minimize overall recall latency.

## Connections

This memory architecture directly implements principles described in [[jarvis-architecture-overview]] as the cognitive subsystem responsible for information processing and recall. The 4-tier structure (with the Compiled Wiki as an extension) builds upon the theoretical foundations outlined in [[the-4-tier-memory-architecture]], providing the technical implementation details. The memory system's functionality enables the personality traits specified in [[jarvis-personality-spec]] by providing the contextual awareness necessary for the measured, precise British English delivery and proactive assistance behaviors. The architecture's semantic memory tier would store and cross-reference concepts from [[nuclear-fusion-energy-breakthroughs-2025]] when researching such topics, demonstrating how the memory system supports knowledge acquisition and synthesis.

## Open Questions

- What are the optimal parameters for the relevance decay algorithm in Short-Term Memory, and how might they be adjusted for different conversation types?
- How should the importance scoring system in Episodic Memory be calibrated to balance between frequent interactions and rare but significant events?
- What would be the most effective approach to prune low-value information from the Compiled Wiki without losing critical knowledge?
- How might the architecture evolve to incorporate emotional memory or affective computing capabilities?
- What are the performance implications of migrating from Prisma to specialized graph databases like Neo4j or TigerGraph for the Semantic Memory tier?

## Extracted Entities

- PERSON: Atkinson — psychologist who developed multi-store model of memory
- PERSON: Shiffrin — psychologist who developed multi-store model of memory
- PERSON: Tulving — psychologist who distinguished between episodic and semantic memory
- PERSON: Karpathy — computer scientist known for knowledge compilation techniques
- CONCEPT: Atkinson-Shiffrin model — 1968 theory of information processing with sensory, short-term, and long-term stores
- CONCEPT: Tulving's distinction — 1972 differentiation between episodic and semantic long-term memory
- CONCEPT: LRU — Least Recently Used cache eviction policy
- CONCEPT: cosine distance — similarity measure between vectors used in semantic recall
- CONCEPT: RAG — Retrieval-Augmented Generation, contrasted with the Compiled Wiki approach

## Tags

memory-architecture, cognitive-science, information-processing, knowledge-management, episodic-memory, semantic-memory, second-brain