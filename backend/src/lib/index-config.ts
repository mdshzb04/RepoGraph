/** Fast index (~1–2 min) is default; set INDEX_MODE=full for complete deep indexing. */
export function isFullIndexMode(): boolean {
  return process.env.INDEX_MODE?.trim().toLowerCase() === "full";
}

export function indexMaxFiles(): number {
  const raw = process.env.INDEX_MAX_FILES?.trim();
  if (raw) return Math.max(10, Number.parseInt(raw, 10) || 40);
  return isFullIndexMode() ? 80 : 40;
}

export function indexEmbedLimit(): number {
  const raw = process.env.INDEX_EMBED_LIMIT?.trim();
  if (raw) return Math.max(8, Number.parseInt(raw, 10) || 48);
  return isFullIndexMode() ? 9999 : 48;
}

export function skipIndexLlmSummary(): boolean {
  return !isFullIndexMode();
}

export function skipIndexAiInsights(): boolean {
  return !isFullIndexMode();
}
