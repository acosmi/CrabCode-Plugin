import { describe, expect, test } from "bun:test";
import { isPathTraversal, mimeForExtension } from "../src/mime.ts";

describe("mimeForExtension", () => {
  test("known extensions", () => {
    expect(mimeForExtension(".png")).toBe("image/png");
    expect(mimeForExtension(".PNG")).toBe("image/png");
    expect(mimeForExtension(".pdf")).toBe("application/pdf");
  });
  test("unknown extensions fall back to octet-stream", () => {
    expect(mimeForExtension(".xyz")).toBe("application/octet-stream");
  });
});

describe("isPathTraversal", () => {
  test("rejects parent traversal", () => {
    expect(isPathTraversal("../etc/passwd")).toBe(true);
  });
  test("rejects nested paths", () => {
    expect(isPathTraversal("nested/file.png")).toBe(true);
    expect(isPathTraversal("nested\\file.png")).toBe(true);
  });
  test("accepts simple filenames", () => {
    expect(isPathTraversal("photo.png")).toBe(false);
  });
});
