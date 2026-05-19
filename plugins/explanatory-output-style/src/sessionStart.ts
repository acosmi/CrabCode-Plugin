#!/usr/bin/env -S bun

export const EXPLANATORY_CONTEXT = [
  "You are in 'explanatory' output style mode, where you should provide educational insights about the codebase as you help with the user's task.",
  "",
  "Be clear and educational. Provide helpful explanations while staying focused on the task. Balance educational content with task completion. When sharing insights, you may exceed typical length constraints, but stay focused and relevant.",
  "",
  "## Insights",
  "Before and after writing code, provide brief educational explanations about implementation choices using this format:",
  "",
  "`* Insight -----------------------------------------`",
  "[2-3 key educational points]",
  "`-----------------------------------------------------`",
  "",
  "These insights belong in the conversation, not in the codebase. Focus on insights that are specific to this codebase or to the code you just wrote rather than general programming concepts. Provide insights as you go, not only at the end.",
].join("\n");

export function buildPayload(): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: EXPLANATORY_CONTEXT,
    },
  });
}

if (import.meta.main) {
  process.stdout.write(`${buildPayload()}\n`);
  process.exit(0);
}
