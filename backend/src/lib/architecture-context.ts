import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { DiagramLabels } from "./excalidraw-scene";

/** Plain-text summary only — strips legacy LLM markdown/mermaid/labels blobs. */
export function sanitizeSummary(text: string): string {
  let s = text.trim();
  s = s.replace(/^#+\s*Project Summary\s*/im, "");
  s = s.replace(/^#+\s*Mermaid Architecture Diagram\s*/im, "");
  s = s.replace(/---MERMAID---[\s\S]*/i, "");
  s = s.replace(/---LABELS---[\s\S]*/i, "");
  s = s.replace(/```mermaid[\s\S]*?```/gi, "");
  s = s.replace(/```json[\s\S]*?```/gi, "");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Drop HTML/login pages accidentally stored as diagram text. */
export function sanitizeMermaid(text: string): string {
  const s = text.trim();
  if (!s) return "";
  const head = s.slice(0, 256).toLowerCase();
  if (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.includes("sign in to github")
  ) {
    return "";
  }
  return s;
}

export function buildMermaidFromArchitecture(
  arch: ArchitectureAnalysis,
  hints?: string
): string {
  const lines = ["graph TD"];
  const nodeBySvc = new Map<string, string>();
  let n = 0;

  const add = (label: string) => {
    const id = `N${n++}`;
    lines.push(`  ${id}["${label.replace(/"/g, "'")}"]`);
    return id;
  };

  const user = add("User");
  const fe = arch.services.find((s) => s.type === "frontend");
  const api = arch.services.find((s) => s.type === "backend" || s.type === "api");
  const db = arch.services.find((s) => s.type === "database");
  const worker = arch.services.find((s) => s.type === "worker");

  const fId = add(fe?.label ?? "Frontend");
  if (fe) nodeBySvc.set(fe.id, fId);
  const aId = add(api?.label ?? "API");
  if (api) nodeBySvc.set(api.id, aId);
  lines.push(`  ${user} --> ${fId}`);
  lines.push(`  ${fId} -->|HTTP| ${aId}`);

  if (/openai/i.test(hints ?? "")) {
    const ai = add("OpenAI");
    lines.push(`  ${aId} --> ${ai}`);
  }
  if (/pinecone|vector/i.test(hints ?? "")) {
    const v = add("Vector index");
    lines.push(`  ${aId} --> ${v}`);
  }
  if (db) {
    const dId = add(db.label);
    nodeBySvc.set(db.id, dId);
    lines.push(`  ${aId} --> ${dId}`);
  }
  if (worker) {
    const wId = add(worker.label);
    nodeBySvc.set(worker.id, wId);
    lines.push(`  ${aId} --> ${wId}`);
  }

  for (const e of arch.dependencies.slice(0, 8)) {
    const from = nodeBySvc.get(e.from);
    const to = nodeBySvc.get(e.to);
    if (from && to) lines.push(`  ${from} --> ${to}`);
  }

  return lines.join("\n");
}

export function buildLabelsFromArchitecture(arch: ArchitectureAnalysis): DiagramLabels {
  const fe = arch.services.find((s) => s.type === "frontend");
  const api = arch.services.find((s) => s.type === "backend" || s.type === "api");
  return {
    user: "User",
    frontend: fe?.label?.slice(0, 24),
    api: api?.label?.slice(0, 24),
    vector: /pinecone/i.test(arch.insights.join(" ")) ? "Pinecone" : "Vector DB",
  };
}
