---
title: "JARVIS Architecture Overview"
type: concepts
tags: ["ai-architecture", "cognitive-systems", "memory-modeling", "language-models", "knowledge-management", "persona-implementation", "technical-design", "compiled"]
related: ["jarvis-personality-spec", "nuclear-fusion-energy-breakthroughs-2025", "the-4-tier-memory-architecture"]
sources: ["RAW/notes/jarvis-architecture.md"]
compiled_at: "2026-07-04T05:22:56.882Z"
compiled_by: "jarvis-brain"
raw_source: "RAW/notes/jarvis-architecture.md"
staleness_days: 0
---


## Summary

JARVIS (Just A Rather Very Intelligent System) is an advanced AI assistant modeled on the Marvel Cinematic Universe character, built upon a sophisticated five-layer architecture. The system combines user input processing, LLM reasoning through an Anthropic Claude core (with z-ai SDK fallback), a multi-tiered memory subsystem, web research capabilities, and ElevenLabs TTS output with a Paul Bettany timbre. The system's personality is precisely defined through a formal British register, dry deadpan wit, unflappable calm, proactive helpfulness, gentle pushback, and genuine warmth, all implemented through a carefully crafted system prompt. The memory architecture draws inspiration from human cognition, featuring five distinct tiers from sensory buffer to compiled wiki knowledge, enabling both immediate processing and long-term information retention.

## Key Facts

- JARVIS operates on a five-layer architecture: User input, Brain (LLM reasoning), Memory subsystem, Hands (web research), and Voice (TTS output)
- The Brain is powered by Anthropic Claude with z-ai SDK as a fallback, with personality encoded through a specialized system prompt
- The Memory subsystem features five cognitive tiers: Sensory Buffer, Short-Term Memory, Episodic Memory, Semantic Memory, and Compiled Wiki
- The Hands component is a web research pipeline that auto-detects when fresh information is needed
- The Voice uses ElevenLabs TTS with a cloned Paul Bettany timbre, falling back to z-ai TTS when unconfigured
- The personality is defined by six pillars: formal British register, dry deadpan wit, unflappable calm, proactive helpfulness, gentle pushback, and genuine warmth
- All external dependencies are isolated behind single-function seams for easy replacement
- The system is built on Next.js 16 with TypeScript 5, Tailwind CSS 4, Prisma ORM with SQLite, and Zustand for client state
- The Second Brain design separates compile-time knowledge synthesis from query-time retrieval

## Connections

This architecture document provides the foundational technical implementation details for [[jarvis-personality-spec]], which outlines the behavioral characteristics implemented through the system prompt. The memory architecture described here directly relates to [[the-4-tier-memory-architecture]], though this document reveals an additional tier (Compiled Wiki) that wasn't previously documented. The research capabilities mentioned in this document would be utilized when compiling knowledge about [[nuclear-fusion-energy-breakthroughs-2025]] or other emerging topics requiring current information. The overall architecture could benefit from a deeper exploration of how the system interacts with external knowledge bases, potentially requiring a new page on [[knowledge-integration-protocols]].

## Open Questions

- What specific techniques are used for relevance decay in the short-term memory conversation window?
- How does the system handle conflicts between different memory tiers when recalling information?
- What are the precise criteria for determining when to trigger web research versus relying on existing knowledge?
- How does the system maintain consistency between the formal British register and the dry deadpan wit across different contexts?
- What are the performance implications of the parallel memory tier fetching approach?

## Extracted Entities

- PERSON: Paul Bettany — voice actor model for TTS
- PROJECT: JARVIS — advanced AI assistant system
- PROJECT: z-ai — fallback SDK for LLM, TTS, and web search
- PROJECT: Anthropic Claude — primary LLM reasoning core
- CONCEPT: Sensory Buffer — volatile memory tier with 8 entries and ~5s horizon
- CONCEPT: Short-Term Memory — 24-turn conversation window with relevance decay
- CONCEPT: Episodic Memory — long-term vector log with cosine similarity recall
- CONCEPT: Semantic Memory — knowledge graph of entities and relations
- CONCEPT: Compiled Wiki — Karpathy Second Brain knowledge base
- CONCEPT: Second Brain — knowledge design separating synthesis from retrieval
- TECHNOLOGY: Next.js 16 — frontend framework
- TECHNOLOGY: TypeScript 5 — programming language
- TECHNOLOGY: Tailwind CSS 4 — styling framework
- TECHNOLOGY: Prisma ORM — database access layer
- TECHNOLOGY: SQLite — database system
- TECHNOLOGY: Zustand — client state management

## Tags

ai-architecture, cognitive-systems, memory-modeling, language-models, knowledge-management, persona-implementation, technical-design