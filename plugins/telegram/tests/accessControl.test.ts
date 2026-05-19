import { describe, expect, test } from "bun:test";
import {
  decideDm,
  decideGroupMessage,
  defaultAccess,
  generatePairingCode,
  parsePermissionReply,
} from "../src/accessControl.ts";

describe("parsePermissionReply", () => {
  test("accepts 'y abcde'", () => {
    expect(parsePermissionReply("y abcde")).toEqual({ decision: "allow", code: "abcde" });
  });
  test("accepts 'YES abcde' (case-insensitive)", () => {
    expect(parsePermissionReply("YES abcde")).toEqual({ decision: "allow", code: "abcde" });
  });
  test("accepts 'no abcde'", () => {
    expect(parsePermissionReply("no abcde")).toEqual({ decision: "deny", code: "abcde" });
  });
  test("rejects bare yes", () => {
    expect(parsePermissionReply("yes")).toBeNull();
  });
  test("rejects extra trailing text", () => {
    expect(parsePermissionReply("yes abcde sure")).toBeNull();
  });
  test("rejects codes containing 'l'", () => {
    expect(parsePermissionReply("yes alpha")).toBeNull();
  });
  test("rejects codes shorter or longer than 5", () => {
    expect(parsePermissionReply("yes abcd")).toBeNull();
    expect(parsePermissionReply("yes abcdef")).toBeNull();
  });
});

describe("decideDm", () => {
  test("disabled drops everyone", () => {
    const access = { ...defaultAccess(), dmPolicy: "disabled" as const, allowFrom: ["alice"] };
    expect(decideDm("alice", access).action).toBe("drop");
  });
  test("allowlisted users are delivered regardless of policy", () => {
    const access = { ...defaultAccess(), dmPolicy: "allowlist" as const, allowFrom: ["alice"] };
    expect(decideDm("alice", access).action).toBe("deliver");
  });
  test("allowlist policy drops non-listed users silently", () => {
    const access = { ...defaultAccess(), dmPolicy: "allowlist" as const };
    expect(decideDm("bob", access)).toMatchObject({ action: "drop", reason: "allowlist-only" });
  });
  test("pairing policy emits a pair decision for new sender", () => {
    expect(decideDm("bob", defaultAccess()).action).toBe("pair");
  });
});

describe("decideGroupMessage", () => {
  test("drops messages from non-enabled channels", () => {
    const result = decideGroupMessage("c1", "u1", true, defaultAccess());
    expect(result).toMatchObject({ action: "drop", reason: "not-enabled" });
  });
  test("requires mention when policy says so", () => {
    const access = {
      ...defaultAccess(),
      groups: { c1: { requireMention: true, allowFrom: [] } },
    };
    expect(decideGroupMessage("c1", "u1", false, access)).toMatchObject({
      action: "drop",
      reason: "not-mentioned",
    });
    expect(decideGroupMessage("c1", "u1", true, access).action).toBe("deliver");
  });
  test("allowlist on group restricts senders", () => {
    const access = {
      ...defaultAccess(),
      groups: { c1: { requireMention: false, allowFrom: ["alice"] } },
    };
    expect(decideGroupMessage("c1", "alice", false, access).action).toBe("deliver");
    expect(decideGroupMessage("c1", "bob", false, access)).toMatchObject({
      action: "drop",
      reason: "sender-blocked",
    });
  });
});

describe("generatePairingCode", () => {
  test("produces a five-character code that satisfies the permission-reply regex", () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePairingCode();
      expect(code).toHaveLength(5);
      expect(/^[a-km-z]{5}$/i.test(code)).toBe(true);
    }
  });
  test("deterministic with seeded rng", () => {
    const makeRng = () => {
      let seed = 1;
      return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    };
    expect(generatePairingCode(makeRng())).toBe(generatePairingCode(makeRng()));
  });
});
