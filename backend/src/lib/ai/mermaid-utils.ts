import { sanitizeMermaid } from "../architecture-context";

/** Count Mermaid node declarations (rough heuristic). */
export function countMermaidNodes(mermaid: string): number {
  const lines = mermaid.split("\n");
  let count = 0;
  for (const line of lines) {
    const t = line.trim();
    if (/^\w+\s*[\[\(\{]/.test(t)) count++;
    if (/subgraph\s/i.test(t)) count++;
  }
  return count;
}

export function capMermaidNodes(mermaid: string, maxNodes = 12): string {
  const sanitized = sanitizeMermaid(mermaid);
  if (countMermaidNodes(sanitized) <= maxNodes) return sanitized;
  return sanitized;
}

export function extractMermaid(text: string): string {
  const fenced = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return sanitizeMermaid(fenced[1].trim());
  const anyFence = text.match(/```\s*([\s\S]*?)```/);
  if (anyFence?.[1]?.includes("graph") || anyFence?.[1]?.includes("flowchart")) {
    return sanitizeMermaid(anyFence[1].trim());
  }
  if (/^(graph|flowchart)\s/im.test(text.trim())) {
    return sanitizeMermaid(text.trim());
  }
  return sanitizeMermaid(text.trim());
}

/** Prefer AI refinement when valid; otherwise keep static baseline. */
export function mergeMermaid(
  aiMermaid: string,
  staticMermaid: string,
  maxNodes = 12
): string {
  const ai = extractMermaid(aiMermaid);
  if (ai && countMermaidNodes(ai) <= maxNodes && countMermaidNodes(ai) >= 3) {
    return ai;
  }
  const baseline = extractMermaid(staticMermaid);
  return baseline || ai;
}
