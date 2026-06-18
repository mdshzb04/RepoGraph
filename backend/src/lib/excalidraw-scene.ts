import type { ArchitectureTopology } from "./architecture-topology";
import type { RepoKnowledge } from "./knowledge";

export type DiagramLabels = Partial<{
  user: string;
  frontend: string;
  api: string;
  vector: string;
}>;

export type ExcalidrawScene = {
  elements: Record<string, unknown>[];
  appState: { viewBackgroundColor: string; currentItemStrokeColor: string };
};

let seed = 1;
function nid(prefix: string): string {
  return `${prefix}-${seed++}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

const BASE = {
  angle: 0,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [] as string[],
  frameId: null,
  isDeleted: false,
  link: null,
  locked: false,
};

const LAYER_BG: Record<string, string> = {
  client: "#d0ebff",
  api: "#a5d8ff",
  ai: "#b2f2bb",
  data: "#ffd8a8",
  infra: "#e9ecef",
};

function box(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  bg: string,
  sub?: string
): Record<string, unknown>[] {
  const textId = nid("t");
  const display = sub ? `${label}\n${sub}` : label;
  const height = sub ? h + 12 : h;
  return [
    {
      ...BASE,
      type: "rectangle",
      id,
      x,
      y,
      width: w,
      height: height,
      strokeColor: "#495057",
      backgroundColor: bg,
      fillStyle: "solid",
      strokeWidth: 2,
      roundness: { type: 3 },
      seed: hash(id),
      version: 1,
      versionNonce: hash(`${id}-v`),
      updated: Date.now(),
      boundElements: [{ type: "text", id: textId }],
    },
    {
      ...BASE,
      type: "text",
      id: textId,
      x: x + 8,
      y: y + height / 2 - (sub ? 14 : 10),
      width: w - 16,
      height: sub ? 28 : 20,
      text: display,
      fontSize: sub ? 12 : 14,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: id,
      strokeColor: "#212529",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      baseline: 14,
      seed: hash(textId),
      version: 1,
      versionNonce: hash(`${textId}-v`),
      updated: Date.now(),
    },
  ];
}

function arrow(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Record<string, unknown> {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    ...BASE,
    type: "arrow",
    id,
    x: x1,
    y: y1,
    width: dx,
    height: dy,
    points: [
      [0, 0],
      [dx, dy],
    ],
    endArrowhead: "arrow",
    startArrowhead: null,
    strokeColor: "#868e96",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    seed: hash(id),
    version: 1,
    versionNonce: hash(`${id}-v`),
    updated: Date.now(),
  };
}

/** Build Excalidraw scene from indexed topology — no template nodes. */
export function buildExcalidrawScene(
  repo: RepoKnowledge,
  topology: ArchitectureTopology
): ExcalidrawScene {
  seed = 1;
  const els: Record<string, unknown>[] = [];

  if (!topology.nodes.length) {
    return {
      elements: [],
      appState: {
        viewBackgroundColor: "transparent",
        currentItemStrokeColor: "#495057",
      },
    };
  }

  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const layerOrder = topology.layers.map((l) => l.id);
  const byLayer = new Map<string, typeof topology.nodes>();
  for (const l of layerOrder) byLayer.set(l, []);
  for (const n of topology.nodes) {
    const list = byLayer.get(n.layer) ?? [];
    list.push(n);
    byLayer.set(n.layer, list);
  }

  let y = 40;
  for (const layerId of layerOrder) {
    const nodes = byLayer.get(layerId) ?? [];
    if (!nodes.length) continue;
    const rowW = nodes.length * 180 + (nodes.length - 1) * 24;
    let x = Math.max(40, (920 - rowW) / 2);
    for (const n of nodes) {
      const w = Math.min(170, Math.max(120, n.label.length * 8 + 40));
      const h = 52;
      const rectId = `node-${n.id}`;
      positions.set(n.id, { x, y, w, h });
      els.push(
        ...box(rectId, x, y, w, h, n.label, LAYER_BG[n.layer] ?? "#e9ecef", n.sub)
      );
      x += w + 24;
    }
    y += 100;
  }

  for (const e of topology.edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (!a || !b) continue;
    els.push(
      arrow(
        nid("a"),
        a.x + a.w,
        a.y + a.h / 2,
        b.x,
        b.y + b.h / 2
      )
    );
  }

  return {
    elements: els,
    appState: {
      viewBackgroundColor: "transparent",
      currentItemStrokeColor: "#495057",
    },
  };
}
