"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type {
  CityDistrict,
  ContributionCityData,
  LayoutBuilding,
} from "./types";

const CITY_PALETTE = [
  "#eab308",
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
] as const;

function iso(x: number, z: number): { px: number; py: number } {
  return { px: x - z * 0.5, py: (x + z) * 0.28 };
}

function fillForToken(token: string): string {
  if (token.startsWith("city-hue-")) {
    const idx = Number(token.replace("city-hue-", "")) - 1;
    if (idx >= 0 && idx < CITY_PALETTE.length) return CITY_PALETTE[idx]!;
  }
  if (token.startsWith("chart-")) {
    return `var(--${token})`;
  }
  const idx = Math.abs(hashToken(token)) % CITY_PALETTE.length;
  return CITY_PALETTE[idx]!;
}

function hashToken(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function BuildingShape({
  b,
  contributorLogin,
  onSelect,
  onHover,
}: {
  b: LayoutBuilding;
  contributorLogin: string;
  onSelect: () => void;
  onHover: (ev: React.MouseEvent<SVGGElement>) => void;
}) {
  const { px, py } = iso(b.layoutX, b.layoutZ);
  const w = b.width;
  const d = b.depth;
  const h = b.height;
  const fill = fillForToken(b.colorToken);
  const roof = b.abandoned ? "var(--muted)" : fill;
  const wall = b.abandoned
    ? "color-mix(in oklch, var(--muted) 70%, var(--background))"
    : `color-mix(in oklch, ${fill} 82%, #0a0a12)`;
  const sideWall = b.abandoned
    ? wall
    : `color-mix(in oklch, ${fill} 62%, #050508)`;

  const front = `M ${px} ${py} L ${px + w * 0.5} ${py + w * 0.14} L ${px + w * 0.5} ${py - h + w * 0.14} L ${px} ${py - h} Z`;
  const side = `M ${px + w * 0.5} ${py + w * 0.14} L ${px + w * 0.5 + d * 0.5} ${py + w * 0.14 + d * 0.14} L ${px + w * 0.5 + d * 0.5} ${py - h + w * 0.14 + d * 0.14} L ${px + w * 0.5} ${py - h + w * 0.14} Z`;
  const top = `M ${px} ${py - h} L ${px + w * 0.5} ${py - h + w * 0.14} L ${px + w * 0.5 + d * 0.5} ${py - h + w * 0.14 + d * 0.14} L ${px + d * 0.5} ${py - h + d * 0.14} Z`;

  const glowOpacity = b.windowGlow * (b.abandoned ? 0.15 : 0.85);

  return (
    <motion.g
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: hashDelay(b.id) }}
      className="cursor-pointer"
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      role="button"
      aria-label={`${contributorLogin} building`}
    >
      <path d={side} fill={sideWall} stroke="color-mix(in oklch, var(--border) 80%, transparent)" strokeWidth={0.6} />
      <path d={front} fill={wall} stroke="color-mix(in oklch, var(--border) 80%, transparent)" strokeWidth={0.6} />
      <path d={top} fill={roof} stroke="color-mix(in oklch, var(--border) 70%, transparent)" strokeWidth={0.5} opacity={b.abandoned ? 0.55 : 1} />
      {Array.from({ length: Math.min(b.floors, 6) }).map((_, fi) => {
        const wy = py - h + fi * (h / Math.max(b.floors, 1)) + 6;
        return (
          <rect
            key={fi}
            x={px + 4}
            y={wy}
            width={Math.max(4, w * 0.22)}
            height={5}
            rx={1}
            fill={fill}
            opacity={glowOpacity}
          />
        );
      })}
      <text
        x={px + 2}
        y={py + 10}
        fontSize={7}
        fontWeight={600}
        fill="color-mix(in oklch, var(--foreground) 90%, transparent)"
      >
        {contributorLogin.length > 14
          ? `${contributorLogin.slice(0, 12)}…`
          : contributorLogin}
      </text>
      {b.hasCrane && (
        <g transform={`translate(${px + w * 0.35}, ${py - h - 18})`}>
          <line x1={0} y1={0} x2={0} y2={22} stroke="var(--chart-4)" strokeWidth={2} />
          <line x1={0} y1={4} x2={14} y2={0} stroke="var(--chart-4)" strokeWidth={2} />
        </g>
      )}
      {b.maintenanceLevel > 0.25 && (
        <circle
          cx={px + w * 0.35}
          cy={py - h - 6}
          r={3}
          fill="var(--chart-5)"
          opacity={Math.min(1, b.maintenanceLevel)}
        />
      )}
      {b.abandoned && (
        <text
          x={px + 2}
          y={py + 12}
          fontSize={8}
          fill="var(--muted-foreground)"
        >
          idle
        </text>
      )}
    </motion.g>
  );
}

function hashDelay(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 12) * 0.03;
}

function DistrictPads({ districts, bounds }: { districts: CityDistrict[]; bounds: ContributionCityData["bounds"] }) {
  const cols = Math.ceil(Math.sqrt(districts.length));
  return (
    <>
      {districts.map((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col + 0.15) * (bounds.width / cols);
        const z = (row + 0.12) * (bounds.depth / Math.ceil(districts.length / cols));
        const { px, py } = iso(x, z);
        const w = bounds.width / cols - 16;
        const h = bounds.depth / Math.ceil(districts.length / cols) - 12;
        const padFill = d.inactive
          ? "var(--muted)"
          : fillForToken(`city-hue-${(i % 8) + 1}`);
        return (
          <g key={d.id}>
            <rect
              x={px}
              y={py}
              width={w}
              height={h * 0.35}
              fill={padFill}
              opacity={d.inactive ? 0.2 : 0.28}
              rx={4}
            />
            <text
              x={px + 6}
              y={py + 14}
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {d.name} ({d.fileCount})
            </text>
          </g>
        );
      })}
    </>
  );
}

export const CityRenderer = memo(function CityRenderer({
  data,
  layoutBuildings,
  selectedId,
  onSelectBuilding,
  onHoverBuilding,
  svgRef,
}: {
  data: ContributionCityData;
  layoutBuildings: LayoutBuilding[];
  selectedId: string | null;
  onSelectBuilding: (id: string) => void;
  onHoverBuilding: (id: string | null, ev?: React.MouseEvent) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const contributorById = useMemo(() => {
    const m = new Map(data.contributors.map((c) => [c.id, c]));
    return m;
  }, [data.contributors]);

  const viewH = data.bounds.depth * 0.55 + 120;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${data.bounds.width} ${viewH}`}
      className="h-full w-full max-h-[min(72vh,640px)]"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Contribution City isometric skyline"
    >
      <defs>
        <linearGradient id="city-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0c1222" />
          <stop offset="45%" stopColor="#12101a" />
          <stop offset="100%" stopColor="#1a1028" />
        </linearGradient>
        <radialGradient id="city-glow" cx="85%" cy="8%" r="55%">
          <stop offset="0%" stopColor="rgba(234, 179, 8, 0.18)" />
          <stop offset="55%" stopColor="rgba(96, 165, 250, 0.08)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width={data.bounds.width} height={viewH} fill="url(#city-sky)" />
      <rect width={data.bounds.width} height={viewH} fill="url(#city-glow)" />
      <DistrictPads districts={data.districts} bounds={data.bounds} />
      {data.roads.map((road, ri) => {
        const [a, b] = road.points;
        if (!a || !b) return null;
        const p1 = iso(a[0], a[1]);
        const p2 = iso(b[0], b[1]);
        return (
          <line
            key={road.id}
            x1={p1.px}
            y1={p1.py}
            x2={p2.px}
            y2={p2.py}
            stroke={fillForToken(`city-hue-${(ri % 8) + 1}`)}
            strokeWidth={4}
            strokeDasharray="8 5"
            opacity={0.55}
          />
        );
      })}
      {data.inactiveModules.slice(0, 6).map((mod, i) => {
        const { px, py } = iso(32 + i * 48, data.bounds.depth - 40);
        return (
          <rect
            key={mod.path}
            x={px}
            y={py}
            width={18}
            height={10}
            fill="var(--muted)"
            opacity={0.45}
            rx={2}
          />
        );
      })}
      {layoutBuildings.map((b) => (
        <BuildingShape
          key={b.id}
          b={b}
          contributorLogin={contributorById.get(b.contributorId)?.login ?? b.contributorId}
          onSelect={() => onSelectBuilding(b.id)}
          onHover={(ev) => onHoverBuilding(b.id, ev)}
        />
      ))}
      {data.landmarks.map((lm) => {
        const { px, py } = iso(lm.x, lm.z);
        return (
          <g key={lm.id}>
            <motion.polygon
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              points={`${px},${py - 28} ${px + 14},${py - 8} ${px},${py + 4} ${px - 14},${py - 8}`}
              fill={lm.kind === "star" ? "var(--chart-1)" : "var(--chart-3)"}
              stroke="var(--border)"
              strokeWidth={0.5}
            />
            <text x={px - 16} y={py + 18} fontSize={9} fill="var(--muted-foreground">
              {lm.kind === "star" ? "★" : "⑂"} {lm.value}
            </text>
          </g>
        );
      })}
      {selectedId && (
        <rect
          width={data.bounds.width}
          height={viewH}
          fill="transparent"
          pointerEvents="none"
        />
      )}
    </svg>
  );
});
