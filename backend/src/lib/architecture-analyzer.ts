import type { CodeChunk } from "./knowledge";
import {
  basename,
  detectStack,
  type ManifestMap,
} from "./repo-scanner";

export type ServiceNode = {
  id: string;
  label: string;
  type: "frontend" | "backend" | "api" | "worker" | "database" | "infra";
  paths: string[];
};

export type DependencyEdge = {
  from: string;
  to: string;
  kind: "import" | "api" | "data";
};

export type ApiRoute = {
  method: string;
  path: string;
  file: string;
};

export type ArchitectureAnalysis = {
  structure: string;
  separation: "monolith" | "split" | "frontend-only" | "backend-only" | "mixed";
  services: ServiceNode[];
  dependencies: DependencyEdge[];
  apiRoutes: ApiRoute[];
  folderHierarchy: { path: string; depth: number; kind: string }[];
  insights: string[];
  graphReady: boolean;
  mermaidExtension?: string;
};

function topLevelDirs(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const first = p.split("/")[0];
    if (first && !first.includes(".")) dirs.add(first);
  }
  return [...dirs].sort();
}

function inferApiRoutes(chunks: CodeChunk[]): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const routeRe =
    /\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  const nextRouteRe =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g;

  for (const chunk of chunks) {
    if (!/route\.(ts|js)|api\/|routes\//i.test(chunk.path)) continue;
    let m: RegExpExecArray | null;
    const text = chunk.content;
    while ((m = routeRe.exec(text))) {
      routes.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file: chunk.path,
      });
    }
    if (/app\/api\//.test(chunk.path)) {
      const pathFromFile = chunk.path
        .replace(/^src\//, "")
        .replace(/\/route\.(ts|js)$/, "")
        .replace(/\[(\w+)\]/g, ":$1");
      while ((m = nextRouteRe.exec(text))) {
        routes.push({ method: m[1], path: `/${pathFromFile}`, file: chunk.path });
      }
    }
  }
  return routes.slice(0, 24);
}

function inferDependencies(chunks: CodeChunk[], services: ServiceNode[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const serviceIds = new Set(services.map((s) => s.id));

  for (const chunk of chunks.slice(0, 40)) {
    const imports = chunk.content.match(/from\s+["']([^"']+)["']/g) ?? [];
    for (const imp of imports) {
      const target = imp.replace(/from\s+["']/, "").replace(/["']$/, "");
      if (target.startsWith("@/") || target.startsWith("./")) {
        const fromSvc = services.find((s) =>
          s.paths.some((p) => chunk.path.startsWith(p.split("/")[0] ?? ""))
        )?.id;
        if (fromSvc && serviceIds.has("core")) {
          edges.push({ from: fromSvc, to: "core", kind: "import" });
        }
      }
    }
    if (/supabase|prisma|mongoose|pg\./i.test(chunk.content)) {
      edges.push({ from: "api", to: "database", kind: "data" });
    }
    if (/inngest|bull|queue/i.test(chunk.content)) {
      edges.push({ from: "api", to: "workers", kind: "api" });
    }
  }

  return [...new Map(edges.map((e) => [`${e.from}-${e.to}`, e])).values()].slice(0, 16);
}

export function analyzeArchitecture(
  paths: string[],
  manifests: ManifestMap,
  chunks: CodeChunk[],
  mermaidFromAi?: string
): ArchitectureAnalysis {
  const stack = detectStack(paths, manifests);
  const topDirs = topLevelDirs(paths);
  const insights: string[] = [];

  let separation: ArchitectureAnalysis["separation"] = "mixed";
  if (stack.frontendPaths.length && stack.backendPaths.length) {
    separation = "split";
    insights.push("Clear frontend/backend directory separation detected.");
  } else if (stack.framework === "Next.js") {
    separation = stack.isMonorepo ? "split" : "monolith";
    insights.push("Next.js full-stack layout — API routes may colocate with UI.");
  } else if (stack.frontendPaths.length) {
    separation = "frontend-only";
  } else if (stack.backendPaths.length || stack.runtime === "python" || stack.runtime === "go") {
    separation = "backend-only";
  }

  const services: ServiceNode[] = [];

  if (stack.framework === "Next.js" || stack.frontendPaths.length) {
    services.push({
      id: "frontend",
      label: stack.framework === "Next.js" ? "Next.js App" : "Frontend",
      type: "frontend",
      paths: stack.frontendPaths.length ? stack.frontendPaths : ["src/app", "pages"],
    });
  }

  if (
    stack.backendPaths.length ||
    stack.runtime === "node" ||
    stack.runtime === "python" ||
    stack.runtime === "go"
  ) {
    services.push({
      id: "api",
      label: stack.framework.includes("Express")
        ? "Express API"
        : stack.framework.includes("FastAPI")
          ? "FastAPI"
          : stack.framework.includes("Nest")
            ? "NestJS API"
            : "Backend API",
      type: "backend",
      paths: stack.backendPaths.length ? stack.backendPaths : ["backend", "src"],
    });
  }

  if (paths.some((p) => /inngest|worker|jobs?/i.test(p))) {
    services.push({
      id: "workers",
      label: "Background Workers",
      type: "worker",
      paths: paths.filter((p) => /inngest|worker|jobs?/i.test(p)).slice(0, 5),
    });
    insights.push("Background job / worker layer detected (Inngest or queue).");
  }

  if (
    paths.some((p) => /supabase|prisma|migrations|schema/i.test(p)) ||
    /supabase|prisma|postgres|mongoose/i.test(chunks.map((c) => c.content).join(" "))
  ) {
    services.push({
      id: "database",
      label: "Data Layer",
      type: "database",
      paths: paths.filter((p) => /supabase|prisma|migrations/i.test(p)).slice(0, 5),
    });
  }

  if (hasPath(paths, "Dockerfile") || stack.hasDocker) {
    services.push({
      id: "infra",
      label: "Container Runtime",
      type: "infra",
      paths: ["Dockerfile"],
    });
  }

  if (stack.hasCi) {
    insights.push("CI/CD workflows present — deploy pipelines can be automated.");
  }
  if (stack.hasTypeScript) {
    insights.push("TypeScript adoption improves maintainability and deploy safety.");
  }
  if (topDirs.includes("frontend") && topDirs.includes("backend")) {
    insights.push(`Monorepo layout: ${topDirs.slice(0, 6).join(", ")}.`);
  }

  const apiRoutes = inferApiRoutes(chunks);
  if (apiRoutes.length) {
    insights.push(`${apiRoutes.length} API route handlers indexed.`);
  }

  const dependencies = inferDependencies(chunks, services);

  const folderHierarchy = paths.slice(0, 80).map((p) => ({
    path: p,
    depth: p.split("/").length,
    kind: classifyPath(p),
  }));

  const structure =
    separation === "split"
      ? "Frontend + backend split"
      : separation === "monolith"
        ? "Full-stack monolith"
        : separation === "frontend-only"
          ? "Frontend-focused"
          : separation === "backend-only"
            ? "Backend API"
            : "Mixed / monorepo";

  return {
    structure,
    separation,
    services,
    dependencies,
    apiRoutes,
    folderHierarchy,
    insights: insights.slice(0, 8),
    graphReady: services.length > 0 || Boolean(mermaidFromAi),
    mermaidExtension: mermaidFromAi,
  };
}

function hasPath(paths: string[], name: string): boolean {
  return paths.some((p) => basename(p) === name);
}

function classifyPath(p: string): string {
  if (/\.(tsx|jsx|vue)$/.test(p)) return "ui";
  if (/route\.(ts|js)|\/api\//.test(p)) return "api";
  if (/\.(test|spec)\./.test(p)) return "test";
  if (/Dockerfile|docker-compose/.test(p)) return "infra";
  if (/\.github\/workflows/.test(p)) return "ci";
  if (/package\.json|tsconfig/.test(p)) return "config";
  return "source";
}
