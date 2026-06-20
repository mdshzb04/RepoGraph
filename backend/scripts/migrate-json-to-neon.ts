/**
 * One-time migration: import legacy JSON repo/index-job files into Neon PostgreSQL.
 *
 * Usage (from backend/):
 *   DATABASE_URL="postgresql://..." npm run db:migrate-json
 */
import dotenv from "dotenv";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { connectDatabase, prisma } from "../src/lib/db/client";
import { replaceRepoChunks } from "../src/lib/db/chunk-store";
import { repoKnowledgeToRowData } from "../src/lib/db/repo-mapper";
import type { RepoKnowledge } from "../src/lib/knowledge";
import type { IndexJobRecord } from "../src/lib/index-jobs";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), "data");

async function migrateRepos(): Promise<number> {
  const reposDir = path.join(DATA_DIR, "repos");
  let count = 0;
  try {
    const files = await readdir(reposDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(path.join(reposDir, file), "utf8");
      const knowledge = JSON.parse(raw) as RepoKnowledge;
      const { chunks, ...rest } = knowledge;
      const data = repoKnowledgeToRowData({ ...rest, chunks: [] });
      await prisma.repository.upsert({
        where: { id: knowledge.id },
        create: data,
        update: data,
      });
      await replaceRepoChunks(knowledge.id, chunks ?? []);
      count++;
      console.log(`[migrate] repository ${knowledge.fullName} (${knowledge.id})`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    console.log("[migrate] no data/repos directory — skipping repositories");
  }
  return count;
}

async function migrateIndexJobs(): Promise<number> {
  const jobsDir = path.join(DATA_DIR, "index-jobs");
  let count = 0;
  try {
    const files = await readdir(jobsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(path.join(jobsDir, file), "utf8");
      const job = JSON.parse(raw) as IndexJobRecord;
      await prisma.indexJob.upsert({
        where: { id: job.id },
        create: {
          id: job.id,
          repoId: job.repoId,
          owner: job.owner,
          repo: job.repo,
          fullName: job.fullName,
          status: job.status,
          progress: job.progress,
          step: job.step,
          error: job.error ?? null,
          result: job.result ?? undefined,
          indexedBySub: job.indexedBySub ?? null,
          indexedByEmail: job.indexedByEmail ?? null,
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
        },
        update: {
          status: job.status,
          progress: job.progress,
          step: job.step,
          error: job.error ?? null,
          result: job.result ?? undefined,
          updatedAt: new Date(job.updatedAt),
        },
      });
      count++;
      console.log(`[migrate] index job ${job.id} (${job.fullName})`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    console.log("[migrate] no data/index-jobs directory — skipping jobs");
  }
  return count;
}

async function main(): Promise<void> {
  await connectDatabase();
  const repoCount = await migrateRepos();
  const jobCount = await migrateIndexJobs();
  console.log(`[migrate] done — ${repoCount} repositories, ${jobCount} index jobs`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
