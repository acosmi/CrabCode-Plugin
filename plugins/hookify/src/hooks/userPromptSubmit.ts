#!/usr/bin/env -S bun
import { runHookCli } from "../hookRunner.ts";

if (import.meta.main) {
  await runHookCli("UserPromptSubmit");
}
