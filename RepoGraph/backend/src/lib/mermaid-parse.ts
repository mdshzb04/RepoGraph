import type { DiagramLabels } from "./excalidraw-scene";

/** Extract Mermaid diagram + summary (+ optional diagram labels) from LLM output. */
export function parseLlmArchitectureResponse(text: string): {
  summary: string;
  mermaid: string;
  labels?: DiagramLabels;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { summary: "", mermaid: "" };
  }

  if (trimmed.includes("---MERMAID---")) {
    const [summary, rest] = trimmed.split("---MERMAID---");
    const { mermaid, labels } = splitMermaidAndLabels(rest ?? "");
    return {
      summary: summary.trim(),
      mermaid,
      labels,
    };
  }

  const fenced = trimmed.match(/```mermaid\s*([\s\S]*?)```/i);
  if (fenced) {
    const summary = trimmed.replace(/```mermaid[\s\S]*?```/i, "").trim();
    return {
      summary,
      mermaid: fenced[1].trim(),
    };
  }

  return { summary: trimmed, mermaid: "" };
}

function extractMermaidBlock(text: string): string {
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.replace(/```mermaid\n?|```/g, "").trim();
}

function splitMermaidAndLabels(rest: string): {
  mermaid: string;
  labels?: DiagramLabels;
} {
  if (!rest.includes("---LABELS---")) {
    return { mermaid: extractMermaidBlock(rest) };
  }
  const [mermaidPart, labelsPart] = rest.split("---LABELS---");
  let labels: DiagramLabels | undefined;
  try {
    const json = labelsPart.trim().replace(/```json\n?|```/g, "");
    labels = JSON.parse(json) as DiagramLabels;
  } catch {
    labels = undefined;
  }
  return { mermaid: extractMermaidBlock(mermaidPart), labels };
}
