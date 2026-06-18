import { flushTelemetry, initTelemetry, recordApiRequest } from "./client";

export type ServerlessHandler<T> = (
  request: Request,
  context?: { route?: string }
) => Promise<T>;

/**
 * Wrap a Next.js / serverless route handler with API latency telemetry.
 */
export function withTelemetry<T>(
  route: string,
  handler: ServerlessHandler<T>
): ServerlessHandler<T> {
  return async (request, context) => {
    initTelemetry();
    const start = performance.now();
    let statusCode = 200;
    try {
      const result = await handler(request, context);
      if (result instanceof Response) {
        statusCode = result.status;
      }
      return result;
    } catch (err) {
      statusCode = 500;
      throw err;
    } finally {
      const durationMs = performance.now() - start;
      recordApiRequest(durationMs, route, statusCode, request.method);
      await flushTelemetry();
    }
  };
}
