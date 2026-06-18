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
  const { result } = await trace(opts, fn);
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
    await run.flush();
  } catch (flushErr) {
    console.warn(
      "[traceplane] failed to flush trace:",
      flushErr instanceof Error ? flushErr.message : flushErr
    );
  }
}

export { TraceRun, type TraceOptions };
