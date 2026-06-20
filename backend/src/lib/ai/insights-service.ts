import { saveRepo, type RepoKnowledge } from "../knowledge";
import { aiProvider } from "./provider";
import { reasoningRouter } from "./reasoning-router";
import { computeArchitectureHash } from "./condensed-context";
import { pushOtelEvent } from "../telemetry-stream";

function insightsStillValid(repo: RepoKnowledge): boolean {
  const insights = repo.aiInsights;
  if (!insights) return false;
  if (insights.indexedAt !== repo.indexedAt) return false;
  const hash = computeArchitectureHash(repo);
  if (insights.architectureHash && insights.architectureHash !== hash) return false;
  return Boolean(
    insights.architectureMermaid || insights.workflowMermaid || insights.dependencyAnalysis
  );
}

export async function ensureRepoAiInsights(
  repo: RepoKnowledge,
  options?: { force?: boolean }
): Promise<RepoKnowledge> {
  if (!reasoningRouter.isConfigured()) {
    return repo;
  }
  if (!options?.force && insightsStillValid(repo)) {
    return repo;
  }

  try {
    const insights = await aiProvider.generateInsights(repo);
    const updated: RepoKnowledge = {
      ...repo,
      aiInsights: insights,
      architectureMermaid:
        insights.architectureMermaid || repo.architectureMermaid,
    };
    await saveRepo(updated);
    pushOtelEvent({
      kind: "index",
      name: "engintel.ai.insights",
      value: 1,
      attrs: {
        repo_id: repo.id,
        provider: insights.reasoningProvider ?? "anthropic",
        model: insights.reasoningModel ?? "",
      },
    });
    return updated;
  } catch (err) {
    console.warn("[ai] insights generation failed:", err);
    return repo;
  }
}

export function clearRepoAiInsights(repo: RepoKnowledge): RepoKnowledge {
  if (!repo.aiInsights) return repo;
  const { aiInsights: _, ...rest } = repo;
  return rest as RepoKnowledge;
}
