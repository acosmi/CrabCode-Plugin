import { analyzeProject, renderReport } from "./index.ts";

type CliArgs = {
  cwd: string;
  format: "json" | "markdown";
  help: boolean;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }

  const report = await analyzeProject({ cwd: args.cwd });
  process.stdout.write(renderReport(report, args.format));
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    cwd: process.cwd(),
    format: "markdown",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--cwd":
        args.cwd = requireValue(argv, index, "--cwd");
        index += 1;
        break;
      case "--format": {
        const format = requireValue(argv, index, "--format");
        if (format !== "json" && format !== "markdown") {
          throw new Error("--format must be markdown or json");
        }
        args.format = format;
        index += 1;
        break;
      }
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function helpText(): string {
  return [
    "Usage: crabcode-setup --cwd <path> --format <markdown|json>",
    "",
    "Analyze a repository and recommend CrabCode-native automations.",
    "",
  ].join("\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

