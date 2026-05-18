import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

export type ReadOnlyFileSystem = {
  access(filePath: string): Promise<void>;
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  readdir(
    filePath: string,
    options: { withFileTypes: true },
  ): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
  stat(filePath: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
};

export async function assertAnalyzerSourcesReadOnly(
  root = process.cwd(),
): Promise<string[]> {
  const sourceRoots = [path.join(root, "src")];
  const prohibitedApis = [
    ["append", "File"],
    ["ch", "mod"],
    ["ch", "own"],
    ["copy", "File"],
    ["mk", "dir"],
    ["re", "name"],
    ["rm", "("],
    ["rm", "dir"],
    ["trun", "cate"],
    ["un", "link"],
    ["ut", "imes"],
    ["write", "File"],
  ].map((parts) => parts.join(""));
  const findings: string[] = [];

  for (const sourceRoot of sourceRoots) {
    for (const filePath of await listTypeScriptFiles(sourceRoot)) {
      const text = await readFile(filePath, "utf8");
      for (const apiName of prohibitedApis) {
        if (text.includes(apiName)) {
          findings.push(`${path.relative(root, filePath)} uses ${apiName}`);
        }
      }
    }
  }

  return findings;
}

async function listTypeScriptFiles(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}
