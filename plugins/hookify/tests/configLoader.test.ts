import { describe, expect, test } from "bun:test";
import { ruleFromContent } from "../src/configLoader.ts";

describe("ruleFromContent", () => {
  test("returns null when frontmatter missing", () => {
    expect(ruleFromContent("no frontmatter here")).toBeNull();
  });

  test("converts simple pattern into a regex_match condition", () => {
    const rule = ruleFromContent(
      `---\nname: rm-rf\nenabled: true\nevent: bash\npattern: rm\\s+-rf\n---\n\nDangerous\n`,
    );
    expect(rule?.name).toBe("rm-rf");
    expect(rule?.event).toBe("bash");
    expect(rule?.action).toBe("warn");
    expect(rule?.conditions).toHaveLength(1);
    expect(rule?.conditions[0]?.field).toBe("command");
    expect(rule?.conditions[0]?.pattern).toBe("rm\\s+-rf");
  });

  test("respects explicit conditions list", () => {
    const rule = ruleFromContent(
      `---\nname: env-key\nenabled: true\nevent: file\nconditions:\n  - field: file_path\n    operator: regex_match\n    pattern: \\.env$\n  - field: new_text\n    operator: contains\n    pattern: API_KEY\n---\n\nbody\n`,
    );
    expect(rule?.conditions).toHaveLength(2);
    expect(rule?.conditions[0]?.operator).toBe("regex_match");
    expect(rule?.conditions[1]?.operator).toBe("contains");
  });

  test("captures action: block", () => {
    const rule = ruleFromContent(
      `---\nname: blocker\nenabled: true\nevent: bash\npattern: rm\naction: block\n---\n\nblocked\n`,
    );
    expect(rule?.action).toBe("block");
  });

  test("defaults enabled to true when omitted", () => {
    const rule = ruleFromContent(
      `---\nname: defaults\nevent: bash\npattern: ls\n---\n\nmsg\n`,
    );
    expect(rule?.enabled).toBe(true);
  });
});
