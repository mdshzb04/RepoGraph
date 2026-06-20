import { analyzeArchitecture } from "./architecture-analyzer";
import { buildMermaidFromArchitecture, sanitizeSummary } from "./architecture-context";
import { fetchRepoFiles } from "./github";
import { GithubApiError } from "./github-response";
import { chunkFiles } from "./rag";
import type { ManifestMap } from "./repo-scanner";
import { saveRepo, type RepoKnowledge } from "./knowledge";
import { clearRepoAiInsights } from "./ai/insights-service";

function buildManifests(files: { path: string; content: string }[]): ManifestMap {
  const out: ManifestMap = {};
  for (const f of files) {
    if (
      f.path.endsWith(".json") ||
      f.path.endsWith(".yaml") ||
      f.path.endsWith(".yml") ||
      f.path === "Dockerfile" ||
      f.path.endsWith("requirements.txt") ||
      f.path.endsWith("pyproject.toml") ||
      f.path.endsWith("go.mod")
    ) {
      out[f.path] = f.content;
    }
  }
  return out;
}

export function isContaminatedArchitecture(text: string | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trimStart().slice(0, 512).toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<head>") ||
    t.includes("sign in to github")
  );
}

export type ArchitectureRebuildError = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export type ArchitectureRebuildSuccess = {
  ok: true;
  repo: RepoKnowledge;
  rebuilt: boolean;
};

export async function rebuildArchitectureCache(
  repo: RepoKnowledge,
  githubUserToken?: string | null,
  opts?: { force?: boolean }
): Promise<ArchitectureRebuildSuccess | ArchitectureRebuildError> {
  const contaminated =
    isContaminatedArchitecture(repo.architectureMermaid) ||
    isContaminatedArchitecture(repo.summary);
  const needsRebuild =
    opts?.force ||
    contaminated ||
    !repo.architecture ||
    !(repo.allPaths?.length || repo.folderTree?.length);

  if (!needsRebuild) {
    return { ok: true, repo, rebuilt: false };
  }

  const [owner, name] = repo.fullName.split("/");
  if (!owner || !name) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_REPO",
      error: "Repository full name is invalid",
    };
  }

  try {
    const { files, allPaths } = await fetchRepoFiles(owner, name, 80, githubUserToken);
    if (!files.length) {
      return {
        ok: false,
        status: 403,
        code: "GITHUB_EMPTY_TREE",
        error: "No source files fetched — verify GitHub access for this private repository",
      };
    }

    const manifests = buildManifests(files);
    const chunks = chunkFiles(files);
    const architecture = analyzeArchitecture(allPaths, manifests, chunks);
    const summary = sanitizeSummary(repo.summary);
    const architectureMermaid = buildMermaidFromArchitecture(architecture, summary).slice(
      0,
      4000
    );

    const updated: RepoKnowledge = clearRepoAiInsights({
      ...repo,
      manifests,
      allPaths,
      folderTree: files.map((f) => f.path).slice(0, 120),
      architecture,
      architectureMermaid,
      summary: contaminated ? summary || repo.summary : repo.summary,
    });
    await saveRepo(updated);
    return { ok: true, repo: updated, rebuilt: true };
  } catch (err) {
    if (err instanceof GithubApiError) {
      return {
        ok: false,
        status: err.status >= 400 ? err.status : 502,
        code: err.code,
        error: err.message,
      };
    }
    const message = err instanceof Error ? err.message : "Architecture rebuild failed";
    return {
      ok: false,
      status: 502,
      code: "ARCHITECTURE_REBUILD_FAILED",
      error: message,
    };
  }
}
