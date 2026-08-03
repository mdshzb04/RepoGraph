# Indexing throughput

## Context

RepoGraph builds a code graph by crawling the repository, parsing files, and
resolving edges between symbols. The initial cold-index path is currently
**single-threaded**.

## Why single-threaded first

- **Determinism** — stable visit order keeps graph diffs and golden tests
  reproducible across machines.
- **Bounded memory** — one parse pipeline at a time keeps peak RSS predictable
  on large monorepos.
- **Correctness before parallelism** — edge linking has ordering constraints;
  premature worker pools tend to create racey symbol tables before the schema
  is settled.

## Expected baseline

For a mid-size repo (~5k source files / ~20k edges), a cold index on a typical
developer laptop should finish in a few minutes. Throughput depends mainly on
disk I/O and language mix (TypeScript/Python dominate parse cost).

Record measured cold-index times in CI or local benchmarks before optimizing.

## When to introduce a worker pool

Consider a bounded worker pool for **independent file parsing** when:

1. Measured cold-index latency exceeds product targets, and
2. Profiling shows parse CPU as the bottleneck (not disk or linking).

Keep edge linking single-threaded or shard-aware so symbol resolution stays
consistent.

## Decision

Keep the indexer single-threaded for the cold path. Revisit concurrency only
after we have measured latency and a clear parse-bound bottleneck.
