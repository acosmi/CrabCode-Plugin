type ScalarValue = string | boolean | number;
type FrontmatterValue = ScalarValue | Array<ScalarValue | Record<string, ScalarValue>>;
export type Frontmatter = Record<string, FrontmatterValue>;

export function extractFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  if (!content.startsWith("---")) return { frontmatter: {}, body: content };
  const parts = content.split("---");
  if (parts.length < 3) return { frontmatter: {}, body: content };
  const fmText = parts[1] ?? "";
  const body = parts.slice(2).join("---").trim();
  return { frontmatter: parseSimpleYaml(fmText), body };
}

export function parseSimpleYaml(text: string): Frontmatter {
  const result: Frontmatter = {};
  const lines = text.split("\n");

  let currentKey: string | null = null;
  let currentList: Array<ScalarValue | Record<string, ScalarValue>> = [];
  let currentDict: Record<string, ScalarValue> = {};
  let inList = false;
  let inDictItem = false;

  const flushPending = () => {
    if (inList && currentKey) {
      if (inDictItem && Object.keys(currentDict).length > 0) {
        currentList.push(currentDict);
        currentDict = {};
      }
      result[currentKey] = currentList;
    }
  };

  for (const rawLine of lines) {
    const stripped = rawLine.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;

    if (indent === 0 && stripped.includes(":") && !stripped.startsWith("-")) {
      flushPending();
      currentKey = null;
      currentList = [];
      currentDict = {};
      inList = false;
      inDictItem = false;

      const colon = rawLine.indexOf(":");
      const key = rawLine.slice(0, colon).trim();
      const value = rawLine.slice(colon + 1).trim();

      if (value === "") {
        currentKey = key;
        inList = true;
        currentList = [];
      } else {
        result[key] = coerceScalar(stripQuotes(value));
      }
      continue;
    }

    if (stripped.startsWith("-") && inList) {
      if (inDictItem && Object.keys(currentDict).length > 0) {
        currentList.push(currentDict);
        currentDict = {};
      }
      const itemText = stripped.slice(1).trim();
      if (itemText.includes(":") && itemText.includes(",")) {
        const parts: Record<string, ScalarValue> = {};
        for (const piece of itemText.split(",")) {
          const colon = piece.indexOf(":");
          if (colon < 0) continue;
          const k = piece.slice(0, colon).trim();
          const v = piece.slice(colon + 1).trim();
          parts[k] = stripQuotes(v);
        }
        currentList.push(parts);
        inDictItem = false;
      } else if (itemText.includes(":")) {
        inDictItem = true;
        const colon = itemText.indexOf(":");
        const k = itemText.slice(0, colon).trim();
        const v = itemText.slice(colon + 1).trim();
        currentDict = { [k]: stripQuotes(v) };
      } else {
        currentList.push(stripQuotes(itemText));
        inDictItem = false;
      }
      continue;
    }

    if (indent > 2 && inDictItem && stripped.includes(":")) {
      const colon = stripped.indexOf(":");
      const k = stripped.slice(0, colon).trim();
      const v = stripped.slice(colon + 1).trim();
      currentDict[k] = stripQuotes(v);
    }
  }

  flushPending();
  return result;
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function coerceScalar(value: string): ScalarValue {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
