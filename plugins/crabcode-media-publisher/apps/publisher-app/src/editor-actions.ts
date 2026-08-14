export type EditorFormat = "bold" | "heading-2" | "quote" | "bullet-list";

export type EditorFormatResult = Readonly<{
  value: string;
  selectionStart: number;
  selectionEnd: number;
}>;

function lineRange(value: string, start: number, end: number): { start: number; end: number } {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf("\n", end);
  return { start: lineStart, end: nextBreak === -1 ? value.length : nextBreak };
}

export function applyEditorFormat(value: string, start: number, end: number, format: EditorFormat): EditorFormatResult {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  if (format === "bold") {
    const selected = value.slice(safeStart, safeEnd) || "重点文字";
    const replacement = `**${selected}**`;
    return Object.freeze({
      value: `${value.slice(0, safeStart)}${replacement}${value.slice(safeEnd)}`,
      selectionStart: safeStart + 2,
      selectionEnd: safeStart + 2 + selected.length
    });
  }

  const range = lineRange(value, safeStart, safeEnd);
  const prefix = format === "heading-2" ? "## " : format === "quote" ? "> " : "- ";
  const selectedLines = value.slice(range.start, range.end) || "新段落";
  const replacement = selectedLines.split("\n").map((line) => `${prefix}${line.replace(/^(?:## |> |- )/, "")}`).join("\n");
  return Object.freeze({
    value: `${value.slice(0, range.start)}${replacement}${value.slice(range.end)}`,
    selectionStart: range.start + prefix.length,
    selectionEnd: range.start + replacement.length
  });
}
