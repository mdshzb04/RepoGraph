# Indexing follow-up checklist

Use this when revisiting cold-index performance:

1. Capture cold-index wall time on a fixed fixture repo.
2. Confirm whether CPU is parse-bound vs I/O-bound.
3. Only then consider a bounded parse worker pool.

See also `docs/indexing-throughput.md`.
