import dagre from "dagre";
import type { ArchitectureTopology } from "@/components/copilot/types";

export type LayoutNode = {
  id: string;
  label: string;
  sub?: string;
  layer: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutGroup = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutEdge = {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
};

export type DiagramLayout = {
  width: number;
  height: number;
  nodes: LayoutNode[];
  groups: LayoutGroup[];
  edges: LayoutEdge[];
};

function nodeSize(label: string, sub?: string): { w: number; h: number } {
  const lines = wrapText(label, 22);
  const w = Math.min(240, Math.max(148, Math.max(...lines.map((l) => l.length)) * 7.2 + 32));
  const h = 36 + lines.length * 14 + (sub ? 16 : 0);
  return { w, h };
}

export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

export function layoutTopology(topology: ArchitectureTopology): DiagramLayout | null {
  if (!topology.nodes.length) return null;
  return layoutGraph({
    layers: topology.layers,
    nodes: topology.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      sub: n.sub,
      layer: n.layer,
    })),
    edges: topology.edges,
  });
}

export function layoutWorkflow(wf: {
  steps: { id: string; label: string; detail?: string; layer: string }[];
  edges: { from: string; to: string; label?: string }[];
}): DiagramLayout | null {
  if (!wf.steps.length) return null;
  const layerIds = ["entry", "app", "service", "data", "external"] as const;
  const titles: Record<string, string> = {
    entry: "Entry",
    app: "Application",
    service: "Services",
    data: "Data",
    external: "External",
  };
  const layers = layerIds
    .filter((id) => wf.steps.some((s) => s.layer === id))
    .map((id) => ({ id, title: titles[id] ?? id }));

  return layoutGraph({
    layers,
    nodes: wf.steps.map((s) => ({
      id: s.id,
      label: s.label,
      sub: s.detail,
      layer: s.layer,
    })),
    edges: wf.edges,
  });
}

function layoutGraph(input: {
  layers: { id: string; title: string }[];
  nodes: { id: string; label: string; sub?: string; layer: string }[];
  edges: { from: string; to: string; label?: string }[];
}): DiagramLayout | null {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: "TB",
    ranksep: 72,
    nodesep: 48,
    edgesep: 24,
    marginx: 48,
    marginy: 48,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const layer of input.layers) {
    g.setNode(`cluster-${layer.id}`, { label: layer.title });
  }

  for (const n of input.nodes) {
    const { w, h } = nodeSize(n.label, n.sub);
    g.setNode(n.id, { width: w, height: h, label: n.label });
    if (input.layers.some((l) => l.id === n.layer)) {
      g.setParent(n.id, `cluster-${n.layer}`);
    }
  }

  for (const e of input.edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) {
      g.setEdge(e.from, e.to, { label: e.label ?? "" });
    }
  }

  dagre.layout(g);

  const nodes: LayoutNode[] = [];
  const groups: LayoutGroup[] = [];

  for (const layer of input.layers) {
    const cid = `cluster-${layer.id}`;
    if (!g.hasNode(cid)) continue;
    const c = g.node(cid);
    if (c?.width && c?.height) {
      groups.push({
        id: cid,
        title: layer.title,
        x: c.x - c.width / 2,
        y: c.y - c.height / 2,
        width: c.width,
        height: c.height,
      });
    }
  }

  for (const n of input.nodes) {
    const d = g.node(n.id);
    if (!d) continue;
    const { w, h } = nodeSize(n.label, n.sub);
    nodes.push({
      id: n.id,
      label: n.label,
      sub: n.sub,
      layer: n.layer,
      x: d.x - w / 2,
      y: d.y - h / 2,
      width: w,
      height: h,
    });
  }

  const edges: LayoutEdge[] = [];
  for (const e of input.edges) {
    if (!g.hasEdge(e.from, e.to)) continue;
    const edge = g.edge(e.from, e.to);
    const raw = (edge?.points ?? []) as { x: number; y: number }[];
    edges.push({
      from: e.from,
      to: e.to,
      label: e.label,
      points: orthogonalize(raw),
    });
  }

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const grp of groups) {
    maxX = Math.max(maxX, grp.x + grp.width);
    maxY = Math.max(maxY, grp.y + grp.height);
  }

  return {
    width: Math.max(maxX + 80, 400),
    height: Math.max(maxY + 80, 320),
    nodes,
    groups,
    edges,
  };
}

/** Snap dagre polyline to orthogonal segments for cleaner routing. */
function orthogonalize(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 2) return points;
  const out: { x: number; y: number }[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    if (Math.abs(cur.x - prev.x) > 2 && Math.abs(cur.y - prev.y) > 2) {
      out.push({ x: cur.x, y: prev.y });
    }
    out.push(cur);
  }
  return out;
}

export function edgePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  let d = `M ${first!.x} ${first!.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  return d;
}

export function edgeLabelPoint(points: { x: number; y: number }[]): { x: number; y: number } {
  const mid = Math.floor((points.length - 1) / 2);
  const a = points[mid]!;
  const b = points[mid + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 };
}
