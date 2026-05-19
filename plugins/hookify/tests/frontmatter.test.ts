import { describe, expect, test } from "bun:test";
import { extractFrontmatter, parseSimpleYaml } from "../src/frontmatter.ts";

describe("extractFrontmatter", () => {
  test("returns empty when no leading ---", () => {
    const result = extractFrontmatter("no frontmatter");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("no frontmatter");
  });

  test("parses simple frontmatter and body", () => {
    const raw = `---\nname: rule\nenabled: true\nevent: bash\npattern: rm\n---\n\nbody text\n`;
    const { frontmatter, body } = extractFrontmatter(raw);
    expect(frontmatter.name).toBe("rule");
    expect(frontmatter.enabled).toBe(true);
    expect(frontmatter.event).toBe("bash");
    expect(frontmatter.pattern).toBe("rm");
    expect(body).toBe("body text");
  });

  test("parses list-of-dict conditions", () => {
    const raw = `---\nname: r\nenabled: true\nevent: file\nconditions:\n  - field: file_path\n    operator: regex_match\n    pattern: \\.env$\n  - field: new_text\n    operator: contains\n    pattern: API_KEY\n---\n\nbody\n`;
    const { frontmatter } = extractFrontmatter(raw);
    expect(Array.isArray(frontmatter.conditions)).toBe(true);
    const conditions = frontmatter.conditions as Array<Record<string, string>>;
    expect(conditions).toHaveLength(2);
    expect(conditions[0]?.field).toBe("file_path");
    expect(conditions[0]?.pattern).toBe("\\.env$");
    expect(conditions[1]?.pattern).toBe("API_KEY");
  });
});

describe("parseSimpleYaml", () => {
  test("coerces boolean values", () => {
    const fm = parseSimpleYaml("enabled: true\ndisabled: false");
    expect(fm.enabled).toBe(true);
    expect(fm.disabled).toBe(false);
  });

  test("strips quotes from values", () => {
    const fm = parseSimpleYaml(`a: "hello"\nb: 'world'`);
    expect(fm.a).toBe("hello");
    expect(fm.b).toBe("world");
  });
});
