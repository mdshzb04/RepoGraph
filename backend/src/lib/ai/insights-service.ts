import { saveRepo, type RepoKnowledge } from "../knowledge";
import { aiProvider } from "./provider";
import { pushOtelEvent } from "../telemetry-stream";

export async function ensureRepoAiInsights(
  repo: RepoKnowledge,
  options?: { force?: boolean }
): Promise<RepoKnowledge> {
  if (!aiProvider.claude.isConfigured()) {
    return repo;
  }
  if (repo.aiInsights && !options?.force) {
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
      attrs: { repo_id: repo.id, provider: "anthropic" },
    });
    return updated;
  } catch (err) {
    console.warn("[ai] insights generation failed:", err);
    return repo;
  }
}
