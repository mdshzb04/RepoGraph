import type { DiagramLayout } from "./diagram-layout";
import { wrapText } from "./diagram-layout";
import type { ExcalidrawScene } from "@/components/copilot/types";

let seed = 1;
function nid(p: string) {
  return `${p}-${seed++}`;
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

const BASE = {
  angle: 0,
  strokeStyle: "solid" as const,
  roughness: 1,
  opacity: 100,
  groupIds: [] as string[],
  frameId: null,
  isDeleted: false,
  link: null,
  locked: false,
};

const LAYER_BG: Record<string, string> = {
  client: "#dbeafe",
  api: "#bfdbfe",
  ai: "#bbf7d0",
  data: "#fed7aa",
  infra: "#f3f4f6",
  entry: "#dbeafe",
  app: "#bfdbfe",
  service: "#bbf7d0",
  external: "#f3f4f6",
};

/** Arrows first, nodes + text last so labels stay readable. */
export function layoutToExcalidraw(layout: DiagramLayout): ExcalidrawScene {
  seed = 1;
  const arrows: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];

  for (const e of layout.edges) {
    if (e.points.length < 2) continue;
    const [p0, ...rest] = e.points;
    const rel = rest.map((p) => [p.x - p0!.x, p.y - p0!.y]);
    arrows.push({
      ...BASE,
      type: "arrow",
      id: nid("arrow"),
      x: p0!.x,
      y: p0!.y,
      width: rest.at(-1)!.x - p0!.x,
      height: rest.at(-1)!.y - p0!.y,
      points: [[0, 0], ...rel],
      endArrowhead: "arrow",
      startArrowhead: null,
      strokeColor: "#94a3b8",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1.5,
      opacity: 70,
      seed: hash(e.from + e.to),
      version: 1,
      versionNonce: hash(`${e.from}-${e.to}`),
      updated: Date.now(),
    });
  }

  for (const n of layout.nodes) {
    const rectId = nid("rect");
    const textId = nid("text");
    const lines = wrapText(n.label, 22);
    const title = lines.join("\n");
    const display = n.sub ? `${title}\n${n.sub}` : title;
    const h = n.height;

    nodes.push(
      {
        ...BASE,
        type: "rectangle",
        id: rectId,
        x: n.x,
        y: n.y,
        width: n.width,
        height: h,
        strokeColor: "#475569",
        backgroundColor: LAYER_BG[n.layer] ?? "#f3f4f6",
        fillStyle: "solid",
        strokeWidth: 2,
        roundness: { type: 3 },
        seed: hash(rectId),
        version: 1,
        versionNonce: hash(`${rectId}-v`),
        updated: Date.now(),
        boundElements: [{ type: "text", id: textId }],
      },
      {
        ...BASE,
        type: "text",
        id: textId,
        x: n.x + 10,
        y: n.y + h / 2 - (n.sub ? 16 : 10),
        width: n.width - 20,
        height: h - 16,
        text: display,
        fontSize: n.sub ? 13 : 15,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: rectId,
        strokeColor: "#0f172a",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        baseline: 16,
        seed: hash(textId),
        version: 1,
        versionNonce: hash(`${textId}-v`),
        updated: Date.now(),
      }
    );
  }

  return {
    elements: [...arrows, ...nodes],
    appState: {
      viewBackgroundColor: "transparent",
      currentItemStrokeColor: "#475569",
    },
  };
}
