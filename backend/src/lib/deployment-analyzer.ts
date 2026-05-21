import type { RepoKnowledge } from "./knowledge";
import {
  detectStack,
  extractEnvVars,
  hasFile,
  type ManifestMap,
} from "./repo-scanner";

export type CheckStatus = "ok" | "warn" | "fail";

export type ReadinessCheck = {
  label: string;
  status: CheckStatus;
};

export type DeployRecommendation = {
  role: string;
  provider: string;
  reason: string;
  url: string;
};

export type DeploymentAnalysis = {
  framework: string;
  techStack: string[];
  packageManager: string;
  structure: string;
  database?: string;
  hasDocker: boolean;
  hasCi: boolean;
  hasTypeScript: boolean;
  envVars: string[];
  blockers: string[];
  checks: ReadinessCheck[];
  recommendations: DeployRecommendation[];
};

function allPaths(repo: RepoKnowledge): string[] {
  const fromTree = repo.allPaths ?? [];
  const fromFiles = repo.files?.map((f) => f.path) ?? repo.folderTree ?? [];
  const fromChunks = repo.chunks.map((c) => c.path);
  return [...new Set([...fromTree, ...fromFiles, ...fromChunks])];
}

function manifests(repo: RepoKnowledge): ManifestMap {
  return repo.manifests ?? {};
}

function codeBlob(repo: RepoKnowledge): string {
  return repo.chunks.map((c) => `${c.path}\n${c.content}`).join("\n").slice(0, 16000);
}

export function analyzeDeployment(
  repo: RepoKnowledge,
  githubUrl: string
): DeploymentAnalysis {
  const paths = allPaths(repo);
  const mans = manifests(repo);
  const text = codeBlob(repo);
  const stack = detectStack(paths, mans);
  const checks: ReadinessCheck[] = [];
  const blockers: string[] = [];
  const recommendations: DeployRecommendation[] = [];
  const techStack = [...stack.frameworks];

  let database: string | undefined;
  if (/supabase/i.test(text) || hasFile(paths, "supabase")) {
    database = "Supabase (PostgreSQL)";
    techStack.push("Supabase");
  } else if (/prisma/i.test(text) || paths.some((p) => p.includes("prisma/schema"))) {
    database = "PostgreSQL (Prisma)";
    techStack.push("Prisma");
  } else if (/mongoose|mongodb/i.test(text)) {
    database = "MongoDB";
    techStack.push("MongoDB");
  } else if (/pgvector|postgres/i.test(text)) {
    database = "PostgreSQL";
    techStack.push("PostgreSQL");
  }

  if (/inngest/i.test(text)) techStack.push("Inngest");

  /* build/start commands omitted — hosts (Vercel, Railway, Render) infer these from config;
   * monorepos with pyproject + package.json previously produced misleading `poetry build`. */

  let structure = "Monorepo / mixed";
  const hasFrontend =
    stack.frontendPaths.length > 0 ||
    /next|react|vite|vue/i.test(stack.framework);
  const hasBackend =
    stack.backendPaths.length > 0 ||
    /express|fastapi|django|nest|go\.mod/i.test(
      stack.framework + paths.join(" ")
    );

  if (hasFrontend && hasBackend) structure = "Frontend + backend split";
  else if (hasFrontend) structure = "Frontend-focused";
  else if (hasBackend) structure = "Backend API";
  else if (stack.isMonorepo) structure = "Monorepo";

  const envVars = extractEnvVars(text);

  checks.push({
    label: stack.buildScript ? "Build scripts detected" : "No build script detected",
    status: stack.buildScript || !hasFrontend ? "ok" : "warn",
  });
  checks.push({
    label: stack.hasDocker ? "Docker support enabled" : "No Dockerfile found",
    status: stack.hasDocker ? "ok" : "warn",
  });
  checks.push({
    label: stack.hasCi ? "CI/CD pipeline configured" : "No CI/CD pipeline configured",
    status: stack.hasCi ? "ok" : "warn",
  });
  checks.push({
    label: stack.hasTypeScript ? "TypeScript configured" : "TypeScript not detected",
    status: stack.hasTypeScript ? "ok" : "warn",
  });

  const hasManifest =
    hasFile(paths, "package.json") ||
    hasFile(paths, "requirements.txt") ||
    hasFile(paths, "pyproject.toml") ||
    hasFile(paths, "go.mod") ||
    hasFile(paths, "Cargo.toml");

  if (!hasManifest) {
    blockers.push("No recognizable runtime manifest");
    checks.push({ label: "Runtime manifest missing", status: "fail" });
  } else {
    checks.push({ label: "Runtime manifest detected", status: "ok" });
  }

  const clone = githubUrl || `https://github.com/${repo.fullName}`;

  if (hasFrontend || stack.framework === "Next.js") {
    recommendations.push({
      role: "Frontend",
      provider: "Vercel",
      reason: "Optimized for Next.js/React edge deployments",
      url: `https://vercel.com/new/clone?repository-url=${encodeURIComponent(clone)}`,
    });
  }
  if (
    hasBackend ||
    ["Express", "FastAPI", "NestJS", "Django", "Go"].some((f) =>
      stack.framework.includes(f)
    )
  ) {
    recommendations.push({
      role: "Backend API",
      provider: "Railway",
      reason: "Container & API hosting with env management",
      url: "https://railway.app/new",
    });
  }
  if (/inngest/i.test(text) || paths.some((p) => /inngest/i.test(p))) {
    recommendations.push({
      role: "Workers",
      provider: "Inngest",
      reason: "Durable background jobs & workflows",
      url: "https://app.inngest.com/sign-up",
    });
  }

  return {
    framework: stack.framework,
    techStack: [...new Set(techStack)],
    packageManager: stack.packageManager,
    structure,
    database,
    hasDocker: stack.hasDocker,
    hasCi: stack.hasCi,
    hasTypeScript: stack.hasTypeScript,
    envVars,
    blockers,
    checks,
    recommendations,
  };
}
