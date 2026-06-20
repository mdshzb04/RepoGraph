import { randomUUID } from "crypto";
import { prisma } from "./db/client";
import type { Prisma } from "@prisma/client";

export type IndexJobStatus = "queued" | "running" | "completed" | "failed";

export type IndexJobRecord = {
  id: string;
  repoId: string;
  owner: string;
  repo: string;
  fullName: string;
  status: IndexJobStatus;
  progress: number;
  step: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  indexedBySub?: string;
  indexedByEmail?: string;
  result?: Record<string, unknown>;
};

function mapJob(row: {
  id: string;
  repoId: string;
  owner: string;
  repo: string;
  fullName: string;
  status: string;
  progress: number;
  step: string;
  error: string | null;
  result: Prisma.JsonValue;
  indexedBySub: string | null;
  indexedByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IndexJobRecord {
  return {
    id: row.id,
    repoId: row.repoId,
    owner: row.owner,
    repo: row.repo,
    fullName: row.fullName,
    status: row.status as IndexJobStatus,
    progress: row.progress,
    step: row.step,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    indexedBySub: row.indexedBySub ?? undefined,
    indexedByEmail: row.indexedByEmail ?? undefined,
    result:
      row.result && typeof row.result === "object" && !Array.isArray(row.result)
        ? (row.result as Record<string, unknown>)
        : undefined,
  };
}

export async function createIndexJob(input: {
  repoId: string;
  owner: string;
  repo: string;
  indexedBySub?: string;
  indexedByEmail?: string;
}): Promise<IndexJobRecord> {
  const row = await prisma.indexJob.create({
    data: {
      id: randomUUID(),
      repoId: input.repoId,
      owner: input.owner,
      repo: input.repo,
      fullName: `${input.owner}/${input.repo}`,
      status: "queued",
      progress: 0,
      step: "Queued",
      indexedBySub: input.indexedBySub ?? null,
      indexedByEmail: input.indexedByEmail ?? null,
    },
  });
  return mapJob(row);
}

export async function getIndexJob(id: string): Promise<IndexJobRecord | null> {
  const row = await prisma.indexJob.findUnique({ where: { id } });
  return row ? mapJob(row) : null;
}

export async function updateIndexJob(
  id: string,
  patch: Partial<
    Pick<IndexJobRecord, "status" | "progress" | "step" | "error" | "result">
  >
): Promise<IndexJobRecord | null> {
  try {
    const row = await prisma.indexJob.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
        ...(patch.step !== undefined ? { step: patch.step } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        ...(patch.result !== undefined
          ? { result: patch.result as Prisma.InputJsonValue }
          : {}),
      },
    });
    return mapJob(row);
  } catch {
    return null;
  }
}
