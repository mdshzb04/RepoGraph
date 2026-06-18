/**
 * Path- and manifest-based repository heuristics.
 * Single source of truth for stack detection used by deployment, health, and architecture analyzers.
 */

export type ManifestMap = Record<string, string>;

export type StackDetection = {
  runtime: "node" | "python" | "go" | "rust" | "unknown";
  framework: string;
  frameworks: string[];
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "pip" | "poetry" | "unknown";
  hasTypeScript: boolean;
  hasDocker: boolean;
  hasDockerCompose: boolean;
  hasCi: boolean;
  hasTests: boolean;
  hasLint: boolean;
  hasEnvExample: boolean;
  hasReadme: boolean;
  buildScript: boolean;
  startScript: boolean;
  isMonorepo: boolean;
  frontendPaths: string[];
  backendPaths: string[];
};

const MANIFEST_PRIORITY = [
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "package-lock.json",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "tsconfig.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "nest-cli.json",
  "vercel.json",
  "railway.json",
  "render.yaml",
  ".env.example",
  ".env.sample",
  "README.md",
  "jest.config.js",
  "jest.config.ts",
  "vitest.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.json",
  "prettier.config.js",
  ".prettierrc",
];

export function isPriorityManifest(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return MANIFEST_PRIORITY.some(
    (m) => base === m || path.endsWith(`/${m}`)
  );
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function hasFile(paths: string[], name: string): boolean {
  return paths.some((p) => basename(p) === name || p === name);
}

export function hasPathMatching(paths: string[], re: RegExp): boolean {
  return paths.some((p) => re.test(p));
}

export function getManifest(paths: string[], manifests: ManifestMap, name: string): string {
  const key = paths.find((p) => basename(p) === name);
  return key ? manifests[key] ?? "" : "";
}

function jsonDeps(content: string): Record<string, unknown> {
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      scripts?: Record<string, string>;
    };
    return { ...pkg.dependencies, ...pkg.devDependencies, scripts: pkg.scripts };
  } catch {
    return {};
  }
}

export function detectStack(paths: string[], manifests: ManifestMap): StackDetection {
  const pkgJson = getManifest(paths, manifests, "package.json");
  const deps = pkgJson ? (jsonDeps(pkgJson) as Record<string, unknown>) : {};
  const scripts =
    pkgJson && typeof deps.scripts === "object"
      ? (deps.scripts as Record<string, string>)
      : {};

  const frameworks: string[] = [];
  let framework = "Unknown";
  let runtime: StackDetection["runtime"] = "unknown";
  let packageManager: StackDetection["packageManager"] = "unknown";

  if (hasFile(paths, "package.json")) {
    runtime = "node";
    if (hasFile(paths, "pnpm-lock.yaml")) packageManager = "pnpm";
    else if (hasFile(paths, "yarn.lock")) packageManager = "yarn";
    else if (hasFile(paths, "bun.lockb")) packageManager = "bun";
    else packageManager = "npm";

    const depStr = pkgJson.toLowerCase();
    if (
      hasFile(paths, "next.config.js") ||
      hasFile(paths, "next.config.ts") ||
      hasFile(paths, "next.config.mjs") ||
      /"next"\s*:/.test(depStr)
    ) {
      framework = "Next.js";
      frameworks.push("Next.js", "React");
    } else if (hasFile(paths, "nest-cli.json") || /"@nestjs\/core"/.test(depStr)) {
      framework = "NestJS";
      frameworks.push("NestJS", "Node.js");
    } else if (/"express"/.test(depStr) || hasPathMatching(paths, /express/i)) {
      framework = "Express";
      frameworks.push("Express", "Node.js");
    } else if (/"fastify"/.test(depStr)) {
      framework = "Fastify";
      frameworks.push("Fastify", "Node.js");
    } else if (/"vite"/.test(depStr)) {
      framework = "Vite";
      frameworks.push("Vite");
    } else if (/"react"/.test(depStr)) {
      framework = "React";
      frameworks.push("React");
    } else if (/"vue"/.test(depStr)) {
      framework = "Vue";
      frameworks.push("Vue");
    } else {
      framework = "Node.js";
      frameworks.push("Node.js");
    }
  }

  if (hasFile(paths, "requirements.txt") || hasFile(paths, "pyproject.toml")) {
    runtime = "python";
    packageManager = hasFile(paths, "pyproject.toml") ? "poetry" : "pip";
    const req = (
      getManifest(paths, manifests, "requirements.txt") +
      getManifest(paths, manifests, "pyproject.toml")
    ).toLowerCase();
    if (/fastapi|uvicorn/.test(req)) {
      framework = "FastAPI";
      frameworks.push("FastAPI", "Python");
    } else if (/django/.test(req)) {
      framework = "Django";
      frameworks.push("Django", "Python");
    } else if (/flask/.test(req)) {
      framework = "Flask";
      frameworks.push("Flask", "Python");
    } else {
      framework = "Python";
      frameworks.push("Python");
    }
  }

  if (hasFile(paths, "go.mod")) {
    runtime = "go";
    framework = "Go";
    frameworks.push("Go");
  }

  if (hasFile(paths, "Cargo.toml")) {
    runtime = "rust";
    framework = "Rust";
    frameworks.push("Rust");
  }

  const frontendPaths = paths.filter((p) =>
    /^(frontend|client|web|apps\/web|packages\/web)\//i.test(p) ||
    /\/(pages|app)\//.test(p) ||
    /\.(tsx|jsx|vue|svelte)$/.test(p)
  );
  const backendPaths = paths.filter((p) =>
    /^(backend|server|api|services)\//i.test(p) ||
    /\/(routes|controllers|handlers|api)\//i.test(p)
  );

  return {
    runtime,
    framework,
    frameworks: [...new Set(frameworks)],
    packageManager,
    hasTypeScript: hasFile(paths, "tsconfig.json"),
    hasDocker: hasFile(paths, "Dockerfile"),
    hasDockerCompose:
      hasFile(paths, "docker-compose.yml") || hasFile(paths, "docker-compose.yaml"),
    hasCi: hasPathMatching(paths, /\.github\/workflows\//),
    hasTests:
      hasFile(paths, "jest.config.js") ||
      hasFile(paths, "jest.config.ts") ||
      hasFile(paths, "vitest.config.ts") ||
      hasPathMatching(paths, /\/(__tests__|tests?)\//) ||
      Boolean(scripts.test),
    hasLint:
      hasFile(paths, "eslint.config.js") ||
      hasFile(paths, "eslint.config.mjs") ||
      hasFile(paths, ".eslintrc") ||
      hasFile(paths, ".eslintrc.json") ||
      Boolean(scripts.lint),
    hasEnvExample: hasFile(paths, ".env.example") || hasFile(paths, ".env.sample"),
    hasReadme: hasFile(paths, "README.md"),
    buildScript: Boolean(scripts.build),
    startScript: Boolean(scripts.start),
    isMonorepo:
      hasFile(paths, "pnpm-workspace.yaml") ||
      hasPathMatching(paths, /^packages\//) ||
      (hasFile(paths, "package.json") && frontendPaths.length > 0 && backendPaths.length > 0),
    frontendPaths: frontendPaths.slice(0, 20),
    backendPaths: backendPaths.slice(0, 20),
  };
}

export function extractEnvVars(text: string): string[] {
  const found = [
    ...text.matchAll(/process\.env\.([A-Z0-9_]+)/g),
    ...text.matchAll(/env\(["']([A-Z0-9_]+)["']\)/g),
    ...text.matchAll(/os\.environ\[["']([A-Z0-9_]+)["']\]/g),
    ...text.matchAll(/getenv\(["']([A-Z0-9_]+)["']\)/g),
  ].map((m) => m[1]);
  return [...new Set(found)].slice(0, 16);
}
