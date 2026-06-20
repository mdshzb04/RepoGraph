import { inngest, INDEX_REPOSITORY_EVENT } from "./client";
import { runIndexPipeline, type IndexPipelineInput } from "../lib/indexer-pipeline";
import { updateIndexJob } from "../lib/index-jobs";

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

export const indexRepositoryFunction = inngest.createFunction(
  {
    id: "index-repository",
    name: "Index Repository",
    retries: 5,
    concurrency: { limit: 4 },
    triggers: [{ event: INDEX_REPOSITORY_EVENT }],
  },
  async ({ event, step }) => {
    const data = event.data as IndexPipelineInput;

    const ready = await runIndexPipeline(data, (name, fn) =>
      step.run(name, fn) as unknown as ReturnType<typeof fn>
    );

    await updateIndexJob(data.jobId, {
      status: "completed",
      progress: 100,
      step: "Index complete",
      result: repoSummaryPayload(ready),
    });

    return { repoId: ready.id, jobId: data.jobId, status: "completed" };
  }
);

export const inngestFunctions = [indexRepositoryFunction];
