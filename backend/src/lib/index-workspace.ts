import { promises as fs } from "fs";
import path from "path";
import type { ManifestMap } from "./repo-scanner";
import type { CodeChunk } from "./knowledge";

export type IndexWorkspace = {
  repoId: string;
  fullName: string;
  defaultBranch: string;
  files: { path: string; content: string }[];
  allPaths: string[];
  manifests: ManifestMap;
  chunks: CodeChunk[];
  summary?: string;
  llmSummaryUsed?: boolean;
  llmTokens?: number;
  modelId?: string;
};

const WORK_DIR = path.join(process.cwd(), "data", "index-work");

function workspacePath(repoId: string): string {
  return path.join(WORK_DIR, `${repoId}.json`);
}

export async function saveIndexWorkspace(data: IndexWorkspace): Promise<void> {
  await fs.mkdir(WORK_DIR, { recursive: true });
  await fs.writeFile(workspacePath(data.repoId), JSON.stringify(data));
}

export async function loadIndexWorkspace(
  repoId: string
): Promise<IndexWorkspace | null> {
  try {
    const raw = await fs.readFile(workspacePath(repoId), "utf8");
    return JSON.parse(raw) as IndexWorkspace;
  } catch {
    return null;
  }
}

export async function clearIndexWorkspace(repoId: string): Promise<void> {
  try {
    await fs.unlink(workspacePath(repoId));
  } catch {
    /* ignore */
  }
}
