import type { DependencyGraph } from "./dependency-graph";
import { buildDependencyGraph } from "./dependency-graph";
import { buildRepoIntel } from "./repo-intel-analyzer";
import type { RepoKnowledge } from "./knowledge";
import {
  fetchGithubContribSnapshot,
  type GithubContribSnapshot,
} from "./github-contrib";

export type ContributionCityPeriod = "week" | "month" | "all";

export type CityContributor = {
  id: string;
  login: string;
  avatarUrl: string;
  commits: number;
  mergedPrs: number;
  reviews: number;
  heightScore: number;
  primaryLanguage: string;
  recentActivity: number;
};

export type CityDistrict = {
  id: string;
  name: string;
  fileCount: number;
  inactive: boolean;
};

export type CityBuilding = {
  id: string;
  contributorId: string;
  districtId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  language: string;
  colorToken: string;
  windowGlow: number;
  hasCrane: boolean;
  maintenanceLevel: number;
  abandoned: boolean;
};

export type CityRoad = {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  points: [number, number][];
};

export type CityLandmark = {
  id: string;
  kind: "star" | "fork";
  x: number;
  z: number;
  value: number;
};

export type CityInactiveModule = {
  path: string;
  districtId: string;
};

export type ContributionCitySnapshot = {
  fullName: string;
  indexedAt: string;
  generatedAt: string;
  stars: number;
  forks: number;
  openPrs: number;
  openIssues: number;
  districts: CityDistrict[];
  buildings: CityBuilding[];
  roads: CityRoad[];
  landmarks: CityLandmark[];
  contributors: CityContributor[];
  inactiveModules: CityInactiveModule[];
  bounds: { width: number; depth: number };
  githubAvailable: boolean;
};

const LANG_TOKENS = [
  "city-hue-1",
  "city-hue-2",
  "city-hue-3",
  "city-hue-4",
  "city-hue-5",
  "city-hue-6",
  "city-hue-7",
  "city-hue-8",
] as const;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function langToken(lang: string): string {
  return LANG_TOKENS[hashStr(lang) % LANG_TOKENS.length]!;
}

function primaryLangForContributor(
  login: string,
  languages: { name: string; pct: number }[]
): string {
  if (!languages.length) return "TypeScript";
  const idx = hashStr(login) % languages.length;
  return languages[idx]?.name ?? languages[0]!.name;
}

function metricForPeriod(
  c: { weekCommits: number; monthCommits: number; totalContributions: number },
  period: ContributionCityPeriod
): number {
  if (period === "week") return c.weekCommits || Math.ceil(c.totalContributions * 0.02);
  if (period === "month") return c.monthCommits || Math.ceil(c.totalContributions * 0.08);
  return c.totalContributions;
}

function buildDistricts(repo: RepoKnowledge): CityDistrict[] {
  const intel = buildRepoIntel(repo);
  const dirs = intel.activity.topDirs;
  if (!dirs.length) {
    return [{ id: "root", name: "(root)", fileCount: repo.fileCount, inactive: false }];
  }
  const maxFiles = Math.max(...dirs.map((d) => d.files), 1);
  return dirs.map((d) => ({
    id: d.dir.replace(/[^a-z0-9_-]/gi, "_") || "root",
    name: d.dir,
    fileCount: d.files,
    inactive: d.files < maxFiles * 0.15,
  }));
}

function districtForContributor(
  login: string,
  districts: CityDistrict[]
): string {
  if (!districts.length) return "root";
  return districts[hashStr(login) % districts.length]!.id;
}

function buildRoads(
  districts: CityDistrict[],
  graph: DependencyGraph | null,
  bounds: { width: number; depth: number }
): CityRoad[] {
  if (!graph?.edges.length || districts.length < 2) return [];
  const districtIds = districts.map((d) => d.id);
  const clusterToDistrict = new Map<string, string>();
  for (const cluster of graph.clusters) {
    const idx = hashStr(cluster.id) % districtIds.length;
    clusterToDistrict.set(cluster.id, districtIds[idx]!);
  }
  for (const node of graph.nodes) {
    if (!clusterToDistrict.has(node.cluster)) {
      const idx = hashStr(node.id) % districtIds.length;
      clusterToDistrict.set(node.cluster, districtIds[idx]!);
    }
  }

  const centroids = new Map<string, [number, number]>();
  districts.forEach((d, i) => {
    const cols = Math.ceil(Math.sqrt(districts.length));
    const col = i % cols;
    const row = Math.floor(i / cols);
    centroids.set(d.id, [
      (col + 0.5) * (bounds.width / cols),
      (row + 0.5) * (bounds.depth / Math.ceil(districts.length / cols)),
    ]);
  });

  const roads: CityRoad[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges.slice(0, 12)) {
    const fromNode = graph.nodes.find((n) => n.id === edge.from);
    const toNode = graph.nodes.find((n) => n.id === edge.to);
    const fromD = fromNode
      ? clusterToDistrict.get(fromNode.cluster)
      : districtIds[0];
    const toD = toNode ? clusterToDistrict.get(toNode.cluster) : districtIds[1];
    if (!fromD || !toD || fromD === toD) continue;
    const key = [fromD, toD].sort().join("–");
    if (seen.has(key)) continue;
    seen.add(key);
    const a = centroids.get(fromD);
    const b = centroids.get(toD);
    if (!a || !b) continue;
    roads.push({
      id: `road-${roads.length}`,
      fromDistrictId: fromD,
      toDistrictId: toD,
      points: [a, b],
    });
  }
  return roads;
}

function inactiveModules(repo: RepoKnowledge, districts: CityDistrict[]): CityInactiveModule[] {
  const intel = buildRepoIntel(repo);
  const hotPaths = new Set(intel.hotModules.map((m) => m.path));
  const out: CityInactiveModule[] = [];
  for (const f of repo.files ?? []) {
    if (f.chunkCount > 0 && hotPaths.has(f.path)) continue;
    if (f.chunkCount > 2) continue;
    const dir = f.path.includes("/") ? f.path.split("/")[0]! : "(root)";
    const districtId =
      districts.find((d) => d.name === dir)?.id ??
      districts[hashStr(dir) % Math.max(districts.length, 1)]?.id ??
      "root";
    out.push({ path: f.path, districtId });
    if (out.length >= 8) break;
  }
  return out;
}

function syntheticGithub(
  repo: RepoKnowledge,
  profileLogin?: string
): GithubContribSnapshot {
  const intel = buildRepoIntel(repo);
  const dirs = intel.activity.topDirs;
  const ownerLogin = repo.fullName.split("/")[0] ?? "owner";

  const fromDirs: GithubContribSnapshot["contributors"] = (dirs.length
    ? dirs
    : [{ dir: "(root)", files: repo.fileCount }]
  )
    .slice(0, 10)
    .map((d, i) => ({
      login: d.dir === "(root)" ? ownerLogin : d.dir.replace(/[^a-zA-Z0-9_-]/g, "-"),
      avatarUrl: "",
      totalContributions: Math.max(1, d.files),
      weekCommits: Math.max(1, Math.ceil(d.files * 0.04)),
      monthCommits: Math.max(2, Math.ceil(d.files * 0.12)),
    }));

  if (profileLogin && !fromDirs.some((c) => c.login === profileLogin)) {
    fromDirs.unshift({
      login: profileLogin,
      avatarUrl: "",
      totalContributions: Math.max(8, repo.chunkCount),
      weekCommits: 3,
      monthCommits: 10,
    });
  }

  return {
    meta: { stars: 0, forks: 0, openIssues: 0 },
    contributors: fromDirs,
    openPrs: 0,
    mergedPrsByLogin: {},
    reviewsByLogin: {},
    profileLogin,
  };
}

function buildDistrictBuildings(
  districts: CityDistrict[],
  contributors: CityContributor[],
  bounds: { width: number; depth: number }
): CityBuilding[] {
  if (districts.length <= 1) return [];
  const cols = Math.ceil(Math.sqrt(districts.length));
  const maxFiles = Math.max(...districts.map((d) => d.fileCount), 1);

  return districts.map((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const norm = d.fileCount / maxFiles;
    const height = 20 + Math.round(norm * 72);
    const contributorId = `district:${d.id}`;
    return {
      id: `bd-${d.id}`,
      contributorId,
      districtId: d.id,
      x: 56 + col * 88 + (hashStr(d.id) % 14),
      z: bounds.depth - 72 - row * 56,
      width: 22 + Math.min(14, Math.floor(d.fileCount / 4)),
      depth: 20 + Math.min(10, Math.floor(d.fileCount / 6)),
      height,
      floors: Math.max(1, Math.round(height / 16)),
      language: d.name,
      colorToken: langToken(d.name),
      windowGlow: d.inactive ? 0.2 : 0.65 + norm * 0.3,
      hasCrane: !d.inactive && norm > 0.55,
      maintenanceLevel: d.inactive ? 0.5 : 0.1,
      abandoned: d.inactive,
    };
  });
}

export function buildContributionCity(
  repo: RepoKnowledge,
  github: GithubContribSnapshot | null,
  period: ContributionCityPeriod = "all"
): ContributionCitySnapshot {
  const gh = github ?? syntheticGithub(repo);
  const intel = buildRepoIntel(repo);
  const languages = intel.languages;
  const districts = buildDistricts(repo);
  const graph = buildDependencyGraph(repo);
  const bounds = { width: 720, depth: 480 };

  let ghContributors = gh.contributors;
  if (ghContributors.length < 2) {
    const synthetic = syntheticGithub(repo, gh.profileLogin);
    const seen = new Set(ghContributors.map((c) => c.login));
    for (const c of synthetic.contributors) {
      if (!seen.has(c.login)) ghContributors.push(c);
    }
  }

  const maxMetric = Math.max(
    1,
    ...ghContributors.map((c) =>
      metricForPeriod(c, period) +
        (gh.mergedPrsByLogin[c.login] ?? 0) * 2 +
        (gh.reviewsByLogin[c.login] ?? 0)
    )
  );

  const openPrShare = Math.min(gh.openPrs, ghContributors.length);
  const issuePressure = Math.min(1, gh.meta.openIssues / 20);

  const contributors: CityContributor[] = ghContributors.map((c) => {
    const commits = metricForPeriod(c, period);
    const mergedPrs = gh.mergedPrsByLogin[c.login] ?? 0;
    const reviews = gh.reviewsByLogin[c.login] ?? 0;
    const heightScore = commits + mergedPrs * 2 + reviews;
    const recentActivity = Math.min(
      1,
      (c.weekCommits + mergedPrs * 0.5) / Math.max(c.totalContributions, 1)
    );
    return {
      id: c.login,
      login: c.login,
      avatarUrl: c.avatarUrl,
      commits,
      mergedPrs,
      reviews,
      heightScore,
      primaryLanguage: primaryLangForContributor(c.login, languages),
      recentActivity,
    };
  });

  const contributorBuildings: CityBuilding[] = contributors.map((c, i) => {
    const districtId = districtForContributor(c.login, districts);
    const cols = Math.ceil(Math.sqrt(contributors.length));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const norm = c.heightScore / maxMetric;
    const height = 24 + Math.round(norm * 96);
    const floors = Math.max(1, Math.round(height / 18));
    const hasCrane =
      openPrShare > 0 && i < openPrShare && c.recentActivity > 0.1;
    return {
      id: `b-${c.id}`,
      contributorId: c.id,
      districtId,
      x: 48 + col * 72 + (hashStr(c.id) % 12),
      z: 40 + row * 64 + (hashStr(c.login) % 10),
      width: 28 + Math.min(12, Math.floor(c.commits / 10)),
      depth: 24 + Math.min(8, Math.floor(c.mergedPrs)),
      height,
      floors,
      language: c.primaryLanguage,
      colorToken: langToken(c.primaryLanguage),
      windowGlow: Math.min(1, c.recentActivity),
      hasCrane,
      maintenanceLevel: issuePressure,
      abandoned: c.heightScore < maxMetric * 0.08 && period !== "all",
    };
  });

  const districtContributorRows: CityContributor[] = districts
    .filter((d) => d.name !== "(root)" || districts.length === 1)
    .map((d) => ({
      id: `district:${d.id}`,
      login: d.name,
      avatarUrl: "",
      commits: d.fileCount,
      mergedPrs: 0,
      reviews: 0,
      heightScore: d.fileCount,
      primaryLanguage: d.name,
      recentActivity: d.inactive ? 0.15 : 0.7,
    }));

  const allContributors = [...contributors, ...districtContributorRows];
  const districtBuildings = buildDistrictBuildings(
    districts,
    allContributors,
    bounds
  );
  const buildings = [...contributorBuildings, ...districtBuildings];

  const landmarks: CityLandmark[] = [
    {
      id: "landmark-stars",
      kind: "star",
      x: bounds.width - 56,
      z: 32,
      value: gh.meta.stars,
    },
    {
      id: "landmark-forks",
      kind: "fork",
      x: bounds.width - 56,
      z: 88,
      value: gh.meta.forks,
    },
  ];

  return {
    fullName: repo.fullName,
    indexedAt: repo.indexedAt,
    generatedAt: new Date().toISOString(),
    stars: gh.meta.stars,
    forks: gh.meta.forks,
    openPrs: gh.openPrs,
    openIssues: gh.meta.openIssues,
    districts,
    buildings,
    roads: buildRoads(districts, graph, bounds),
    landmarks,
    contributors: allContributors,
    inactiveModules: inactiveModules(repo, districts),
    bounds,
    githubAvailable: Boolean(github),
  };
}

export type ContributionCityCache = {
  snapshot: ContributionCitySnapshot;
  github: GithubContribSnapshot | null;
};

export async function buildContributionCityCache(
  repo: RepoKnowledge,
  githubUserToken?: string | null
): Promise<ContributionCityCache> {
  const github = await fetchGithubContribSnapshot(repo.fullName, githubUserToken);
  return {
    snapshot: buildContributionCity(repo, github, "all"),
    github,
  };
}

export function filterContributionCityByPeriod(
  snapshot: ContributionCitySnapshot,
  repo: RepoKnowledge,
  github: GithubContribSnapshot | null,
  period: ContributionCityPeriod
): ContributionCitySnapshot {
  if (period === "all") return snapshot;
  return buildContributionCity(repo, github, period);
}
