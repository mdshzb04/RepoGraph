import type { Request, Response, NextFunction } from "express";
import { flushTelemetry, initTelemetry, recordApiRequest } from "./client";

export function telemetryMiddleware() {
  initTelemetry();

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    const route = normalizeRoute(req.path);

    res.on("finish", () => {
      const durationMs = performance.now() - start;
      recordApiRequest(durationMs, route, res.statusCode, req.method);
      if (getRuntimeShouldFlush()) {
        void flushTelemetry();
      }
    });

    next();
  };
}

function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f-]{36}/gi, "/:id")
    .replace(/\/\d+/g, "/:id")
    .slice(0, 120);
}

function getRuntimeShouldFlush(): boolean {
  const cfg = initTelemetry();
  return cfg.runtimeMode === "serverless";
}
