import { init, trace, TraceRun, type TraceOptions } from "traceplane";

let enabled = false;

export function initTraceplane(): boolean {
  const apiKey = process.env.TRACEPLANE_API_KEY?.trim();
  if (!apiKey) return false;

  init({
    apiKey,
    baseUrl:
      process.env.TRACEPLANE_BASE_URL?.trim() ??
      "https://traceplane.shazeb.site/api/v1",
  });
  enabled = true;
  return true;
}

export function isTraceplaneEnabled(): boolean {
  return enabled;
}

export async function withTraceplane<T>(
  opts: TraceOptions,
  fn: (run: TraceRun) => Promise<T>
): Promise<T> {
  if (!enabled) {
    throw new Error("Traceplane is not initialized");
  }
  const { result, ingest } = await trace(opts, fn);
  const executionId =
    typeof ingest.execution_id === "string" ? ingest.execution_id : "unknown";
  console.log(
    `[traceplane] trace sent · agent=${opts.agent} execution_id=${executionId}`
  );
  return result;
}

export function startTraceRun(opts: TraceOptions): TraceRun {
  if (!enabled) {
    throw new Error("Traceplane is not initialized");
  }
  return new TraceRun(opts);
}

export async function flushTraceRun(
  run: TraceRun,
  error?: unknown
): Promise<void> {
  if (!enabled) return;
  try {
    if (error) {
      run.error(error instanceof Error ? error.message : String(error));
    }
    const ingest = await run.flush();
    const executionId =
      typeof ingest.execution_id === "string" ? ingest.execution_id : "unknown";
    console.log(`[traceplane] trace flushed · execution_id=${executionId}`);
  } catch (flushErr) {
    console.warn(
      "[traceplane] failed to flush trace:",
      flushErr instanceof Error ? flushErr.message : flushErr
    );
  }
}

export async function recordIndexJobTrace(params: {
  fullName: string;
  fileCount: number;
  chunkCount: number;
  durationMs: number;
  healthScore: number;
  llmSummaryUsed: boolean;
  modelId: string;
  llmTokens?: number;
}): Promise<void> {
  if (!enabled) return;
  try {
    await withTraceplane(
      {
        agent: "repograph-index",
        model: params.modelId,
        provider: "openai",
        framework: "ai-sdk",
        environment: process.env.NODE_ENV ?? "development",
        tags: [params.fullName],
      },
      async (run) => {
        run.setInput(`index ${params.fullName}`);
        run.setOutput(
          `ready · ${params.fileCount} files · ${params.chunkCount} chunks · health ${params.healthScore}/100`
        );
        run.toolCall(
          "index_repository",
          {
            repo: params.fullName,
            files: params.fileCount,
            chunks: params.chunkCount,
            llm_summary: params.llmSummaryUsed,
          },
          { latencyMs: params.durationMs }
        );
        if (params.llmSummaryUsed && params.llmTokens && params.llmTokens > 0) {
          run.llmCall({
            model: params.modelId,
            inputTokens: params.llmTokens,
            outputTokens: 0,
          });
        }
        return null;
      }
    );
  } catch (err) {
    console.warn(
      "[traceplane] failed to record index job:",
      err instanceof Error ? err.message : err
    );
  }
}

export { TraceRun, type TraceOptions };
