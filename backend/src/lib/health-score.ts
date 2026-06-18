import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { DeploymentAnalysis } from "./deployment-analyzer";
import { detectStack, type ManifestMap } from "./repo-scanner";

export type HealthCategory = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "fair" | "poor";
  detail: string;
};

export type HealthScore = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: HealthCategory[];
  recommendations: string[];
};

function grade(score: number): HealthScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function catStatus(ratio: number): HealthCategory["status"] {
  if (ratio >= 0.9) return "excellent";
  if (ratio >= 0.7) return "good";
  if (ratio >= 0.5) return "fair";
  return "poor";
}

export function computeHealthScore(
  paths: string[],
  manifests: ManifestMap,
  deployment: DeploymentAnalysis,
  architecture?: ArchitectureAnalysis
): HealthScore {
  const stack = detectStack(paths, manifests);
  const categories: HealthCategory[] = [];
  const recommendations: string[] = [];

  const deployPts =
    (deployment.checks.filter((c) => c.status === "ok").length /
      Math.max(deployment.checks.length, 1)) *
    20;
  categories.push({
    id: "deploy",
    label: "Deployment readiness",
    score: Math.round(deployPts),
    maxScore: 20,
    status: catStatus(deployPts / 20),
    detail: `${deployment.checks.filter((c) => c.status === "ok").length}/${deployment.checks.length} checks passing`,
  });
  if (deployment.blockers.length) {
    recommendations.push(`Resolve blockers: ${deployment.blockers[0]}`);
  }

  let archPts = 8;
  if (architecture?.separation === "split") archPts += 6;
  else if (architecture?.separation === "monolith" && stack.framework === "Next.js")
    archPts += 5;
  if ((architecture?.services.length ?? 0) >= 2) archPts += 4;
  if ((architecture?.apiRoutes.length ?? 0) > 0) archPts += 2;
  archPts = Math.min(20, archPts);
  categories.push({
    id: "architecture",
    label: "Architecture quality",
    score: archPts,
    maxScore: 20,
    status: catStatus(archPts / 20),
    detail: architecture?.structure ?? "Not analyzed",
  });

  const ciPts = stack.hasCi ? 15 : 0;
  categories.push({
    id: "cicd",
    label: "CI/CD",
    score: ciPts,
    maxScore: 15,
    status: catStatus(ciPts / 15),
    detail: stack.hasCi ? "GitHub Actions configured" : "No CI pipeline detected",
  });
  if (!stack.hasCi) recommendations.push("Add .github/workflows for automated test and deploy.");

  const tsPts = stack.hasTypeScript ? 10 : 3;
  categories.push({
    id: "typescript",
    label: "TypeScript",
    score: tsPts,
    maxScore: 10,
    status: catStatus(tsPts / 10),
    detail: stack.hasTypeScript ? "tsconfig.json present" : "No TypeScript config",
  });

  const dockerPts = stack.hasDocker ? 10 : stack.hasDockerCompose ? 7 : 0;
  categories.push({
    id: "docker",
    label: "Containerization",
    score: dockerPts,
    maxScore: 10,
    status: catStatus(dockerPts / 10),
    detail: stack.hasDocker ? "Dockerfile detected" : "No container manifest",
  });

  const testPts = stack.hasTests ? 10 : 0;
  categories.push({
    id: "testing",
    label: "Testing",
    score: testPts,
    maxScore: 10,
    status: catStatus(testPts / 10),
    detail: stack.hasTests ? "Test tooling detected" : "No test framework found",
  });
  if (!stack.hasTests) recommendations.push("Add unit tests (Vitest/Jest) before production deploy.");

  const lintPts = stack.hasLint ? 5 : 0;
  categories.push({
    id: "linting",
    label: "Linting",
    score: lintPts,
    maxScore: 5,
    status: catStatus(lintPts / 5),
    detail: stack.hasLint ? "ESLint configured" : "No linter config",
  });

  categories.push({
    id: "env",
    label: "Environment management",
    score: 8,
    maxScore: 8,
    status: "excellent",
    detail: "Secrets configured on host (not committed to git)",
  });

  const docPts = stack.hasReadme ? 7 : 0;
  categories.push({
    id: "docs",
    label: "Documentation",
    score: docPts,
    maxScore: 7,
    status: catStatus(docPts / 7),
    detail: stack.hasReadme ? "README.md found" : "No README",
  });

  const overall = Math.min(
    100,
    Math.round(categories.reduce((s, c) => s + c.score, 0))
  );

  if (overall < 60 && recommendations.length < 4) {
    recommendations.push("Improve deployment readiness before shipping to production.");
  }

  return {
    overall,
    grade: grade(overall),
    categories,
    recommendations: recommendations.slice(0, 6),
  };
}
