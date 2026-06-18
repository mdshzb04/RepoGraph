/** In-memory per-run index metrics — exported via ObservableGauge each scrape. */

export type IndexRunMetric = {
  runId: string;
  repo: string;
  repoId: string;
  indexedAt: string;
  durationMs: number;
  files: number;
  chunks: number;
};

const runs = new Map<string, IndexRunMetric>();

/** ~144 ms/chunk from persisted platform runs. */
export function resolveIndexDurationMs(
  durationMs: number | undefined,
  chunks: number,
  files: number
): number {
  if (durationMs != null && durationMs > 0) return durationMs;
  if (chunks <= 0 && files <= 0) return 0;
  return Math.max(1000, Math.round(chunks * 144 + files * 50));
}

export function storeIndexRunMetric(metric: IndexRunMetric): void {
  runs.set(metric.runId, metric);
}

export function getIndexRunMetrics(): IndexRunMetric[] {
  return [...runs.values()].sort(
    (a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime()
  );
}

export function buildIndexRunId(repoId: string, indexedAt?: string): string {
  return indexedAt ? `${repoId}@${indexedAt}` : crypto.randomUUID();
}
