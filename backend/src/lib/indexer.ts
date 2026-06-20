import { randomUUID } from "crypto";
import { createIndexJob } from "./index-jobs";
import { createPendingRepoRecord, type IndexPipelineInput } from "./indexer-pipeline";
import { runIndexPipeline } from "./indexer-pipeline";
import { updateIndexJob } from "./index-jobs";

export type EnqueueIndexResult = {
  jobId: string;
  id: string;
  fullName: string;
  status: "indexing" | "queued";
  progress: number;
  step: string;
  async: boolean;
};

function repoSummaryPayload(repo: Awaited<ReturnType<typeof runIndexPipeline>>) {
  return {
    id: repo.id,
    fullName: repo.fullName,
    status: repo.status,
    summary: repo.summary,
    architectureMermaid: repo.architectureMermaid,
    fileCount: repo.fileCount,
    chunkCount: repo.chunkCount,
    indexedAt: repo.indexedAt,
    embeddingsReady: repo.embeddingsReady ?? false,
    vectorDbHealth: repo.vectorDbHealth ?? "offline",
    languages: repo.languages ?? {},
    folderTree: repo.folderTree ?? [],
    healthScore: repo.healthScore
      ? { overall: repo.healthScore.overall, grade: repo.healthScore.grade }
      : undefined,
    architecture: repo.architecture,
  };
}

async function runPipelineInBackground(input: IndexPipelineInput): Promise<void> {
  try {
    const ready = await runIndexPipeline(input, async (_name, fn) => fn());
    await updateIndexJob(input.jobId, {
      status: "completed",
      progress: 100,
      step: "Index complete",
      result: repoSummaryPayload(ready),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    console.error("[index] pipeline failed:", err);
    await updateIndexJob(input.jobId, {
      status: "failed",
      progress: 0,
      step: "Index failed",
      error: message,
    });
  }
}

export async function enqueueIndexRepository(
  owner: string,
  repo: string,
  options?: {
    githubUserToken?: string | null;
    indexedBySub?: string | null;
    indexedByEmail?: string | null;
  }
): Promise<EnqueueIndexResult> {
  const repoId = randomUUID();
  await createPendingRepoRecord({
    repoId,
    owner,
    repo,
    indexedBySub: options?.indexedBySub ?? undefined,
    indexedByEmail: options?.indexedByEmail ?? undefined,
  });

  const job = await createIndexJob({
    repoId,
    owner,
    repo,
    indexedBySub: options?.indexedBySub ?? undefined,
    indexedByEmail: options?.indexedByEmail ?? undefined,
  });

  const payload: IndexPipelineInput = {
    jobId: job.id,
    repoId,
    owner,
    repo,
    githubUserToken: options?.githubUserToken ?? null,
    indexedBySub: options?.indexedBySub ?? null,
    indexedByEmail: options?.indexedByEmail ?? null,
  };

  void runPipelineInBackground(payload);

  return {
    jobId: job.id,
    id: repoId,
    fullName: `${owner}/${repo}`,
    status: "indexing",
    progress: 0,
    step: "Starting index worker",
    async: true,
  };
}
