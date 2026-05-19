export type Condition = {
  field: string;
  operator: "regex_match" | "contains" | "equals" | "not_contains" | "starts_with" | "ends_with" | string;
  pattern: string;
};

export type Rule = {
  name: string;
  enabled: boolean;
  event: "bash" | "file" | "stop" | "prompt" | "all" | string;
  pattern: string | null;
  conditions: Condition[];
  action: "warn" | "block";
  toolMatcher: string | null;
  message: string;
};

export type ToolInput = Record<string, unknown>;

export type HookInput = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: ToolInput;
  reason?: string;
  transcript_path?: string;
  user_prompt?: string;
  session_id?: string;
};

export type EvaluationResult = Record<string, unknown>;
