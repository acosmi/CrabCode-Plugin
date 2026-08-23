import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const script = path.resolve(
  import.meta.dir,
  "..",
  "scripts",
  "build-deterministic-mirror-archive.py",
);
const fixtures: string[] = [];

afterAll(async () => {
  await Promise.all(
    fixtures.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function command(
  args: string[],
  cwd?: string,
  extraEnv: Record<string, string> = {},
) {
  const options = {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Archive Test",
      GIT_AUTHOR_EMAIL: "archive@example.invalid",
      GIT_COMMITTER_NAME: "Archive Test",
      GIT_COMMITTER_EMAIL: "archive@example.invalid",
      GIT_AUTHOR_DATE: "2026-08-23T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-08-23T00:00:00Z",
      ...extraEnv,
    },
    stdout: "pipe" as const,
    stderr: "pipe" as const,
  };
  return cwd
    ? Bun.spawnSync(args, { ...options, cwd })
    : Bun.spawnSync(args, options);
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mirror-archive-"));
  fixtures.push(root);
  await mkdir(path.join(root, ".crabcode-plugin"), { recursive: true });
  await mkdir(path.join(root, "plugins", "demo", "tests", "fixtures"), {
    recursive: true,
  });
  await mkdir(path.join(root, "plugins", "demo", "scripts"), { recursive: true });
  await writeFile(
    path.join(root, ".crabcode-plugin", "mirror-distribution.json"),
    JSON.stringify({
      excludePrefixes: ["plugins/demo/tests/fixtures/"],
    }),
  );
  await writeFile(path.join(root, "plugins", "demo", "plugin.json"), '{"name":"demo"}\n');
  await writeFile(path.join(root, "plugins", "demo", "tests", "fixtures", "secret.txt"), "trim me\n");
  const executable = path.join(root, "plugins", "demo", "scripts", "run.sh");
  await writeFile(executable, "#!/usr/bin/env bash\necho ok\n");
  await chmod(executable, 0o755);
  expect(command(["git", "init", "-q"], root).exitCode).toBe(0);
  expect(command(["git", "add", "."], root).exitCode).toBe(0);
  expect(command(["git", "commit", "-qm", "fixture"], root).exitCode).toBe(0);
  return root;
}

describe("deterministic mirror archive", () => {
  test("builds identical bytes from the same commit and ignores checkout state", async () => {
    const repo = await repository();
    const first = path.join(repo, "..", `${path.basename(repo)}-first.zip`);
    const second = path.join(repo, "..", `${path.basename(repo)}-second.zip`);
    fixtures.push(first, second);

    const baseArgs = ["python3", script, "--repo", repo, "--commit", "HEAD"];
    expect(command([...baseArgs, "--output", first], undefined, { TZ: "UTC" }).exitCode).toBe(0);
    await writeFile(path.join(repo, "plugins", "demo", "plugin.json"), "uncommitted\n");
    expect(
      command([...baseArgs, "--output", second], undefined, {
        TZ: "Asia/Shanghai",
      }).exitCode,
    ).toBe(0);
    expect(Buffer.from(await readFile(second))).toEqual(Buffer.from(await readFile(first)));

    const inspect = command([
      "python3",
      "-c",
      [
        "import json,stat,sys,zipfile",
        "z=zipfile.ZipFile(sys.argv[1])",
        "names=z.namelist()",
        "mode=z.getinfo('marketplaces/crabcode-plugins-official/plugins/demo/scripts/run.sh').external_attr >> 16",
        "print(json.dumps({'names': names, 'executable': bool(mode & stat.S_IXUSR)}))",
      ].join(";"),
      first,
    ]);
    expect(inspect.exitCode).toBe(0);
    const details = JSON.parse(inspect.stdout.toString()) as {
      names: string[];
      executable: boolean;
    };
    expect(details.names.every((name) => name.startsWith("marketplaces/crabcode-plugins-official/"))).toBe(true);
    expect(details.names.some((name) => name.includes("secret.txt"))).toBe(false);
    expect(details.executable).toBe(true);
  });

  test("accepts identical existing bytes and refuses a same-SHA mismatch", async () => {
    const repo = await repository();
    const built = path.join(repo, "..", `${path.basename(repo)}-built.zip`);
    const rebuilt = path.join(repo, "..", `${path.basename(repo)}-rebuilt.zip`);
    const wrong = path.join(repo, "..", `${path.basename(repo)}-wrong.zip`);
    fixtures.push(built, rebuilt, wrong);
    const baseArgs = ["python3", script, "--repo", repo, "--commit", "HEAD"];

    expect(command([...baseArgs, "--output", built]).exitCode).toBe(0);
    expect(
      command([
        ...baseArgs,
        "--output",
        rebuilt,
        "--existing-archive",
        built,
      ]).exitCode,
    ).toBe(0);
    await writeFile(wrong, "different archive bytes\n");
    const refused = command([
      ...baseArgs,
      "--output",
      rebuilt,
      "--existing-archive",
      wrong,
    ]);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr.toString()).toContain("refusing to overwrite an existing same-SHA archive");
  });

  test("rejects Git archive attributes that could transform the committed file set", async () => {
    const repo = await repository();
    await writeFile(
      path.join(repo, ".gitattributes"),
      "plugins/demo/plugin.json export-ignore\n",
    );
    expect(command(["git", "add", ".gitattributes"], repo).exitCode).toBe(0);
    expect(command(["git", "commit", "-qm", "unsafe attributes"], repo).exitCode).toBe(0);
    const output = path.join(repo, "..", `${path.basename(repo)}-unsafe.zip`);
    fixtures.push(output);
    const result = command([
      "python3",
      script,
      "--repo",
      repo,
      "--commit",
      "HEAD",
      "--output",
      output,
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("forbid export-ignore/export-subst");
  });
});
