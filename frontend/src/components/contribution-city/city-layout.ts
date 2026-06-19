import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { CityBuilding, ContributionCityData, LayoutBuilding } from "./types";

type SimNode = SimulationNodeDatum & {
  id: string;
  x: number;
  y: number;
  r: number;
};

/** Deterministic D3 force layout — positions buildings within city bounds. */
export function layoutCityBuildings(
  data: ContributionCityData
): LayoutBuilding[] {
  const { bounds, buildings } = data;
  if (!buildings.length) return [];

  const nodes: SimNode[] = buildings.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.z,
    r: Math.max(b.width, b.depth) * 0.55,
  }));

  const sim = forceSimulation(nodes)
    .force(
      "x",
      forceX(bounds.width * 0.5)
        .strength(0.04)
    )
    .force(
      "y",
      forceY(bounds.depth * 0.5)
        .strength(0.04)
    )
    .force(
      "collide",
      forceCollide<SimNode>((d) => d.r + 6).strength(0.85)
    )
    .stop();

  for (let i = 0; i < 120; i++) sim.tick();

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return buildings.map((b) => {
    const n = byId.get(b.id)!;
    const layoutX = Math.max(24, Math.min(bounds.width - 48, n.x ?? b.x));
    const layoutZ = Math.max(24, Math.min(bounds.depth - 48, n.y ?? b.z));
    return { ...b, layoutX, layoutZ };
  });
}
