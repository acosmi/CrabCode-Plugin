// Pure helpers extracted from src/server.ts so the access-control rules can be
// unit tested without standing up an MCP server or a real Discord client.

export type DmPolicy = "pairing" | "allowlist" | "disabled";

export type GroupPolicy = {
  requireMention: boolean;
  allowFrom: string[];
};

export type Access = {
  dmPolicy: DmPolicy;
  allowFrom: string[];
  groups: Record<string, GroupPolicy>;
  pending: Record<string, { senderId: string; chatId: string; createdAt: number; expiresAt: number; replies: number }>;
  mentionPatterns?: string[];
};

// Permission-reply spec: 5 lowercase letters a-z minus 'l'. Case-insensitive.
// Strict: no bare yes/no, no prefix/suffix chatter.
export const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;

export function parsePermissionReply(input: string): { decision: "allow" | "deny"; code: string } | null {
  const match = PERMISSION_REPLY_RE.exec(input);
  if (!match) return null;
  const decision = /^y(es)?$/i.test(match[1] ?? "") ? "allow" : "deny";
  return { decision, code: (match[2] ?? "").toLowerCase() };
}

export function defaultAccess(): Access {
  return { dmPolicy: "pairing", allowFrom: [], groups: {}, pending: {} };
}

export type DmDecision =
  | { action: "deliver"; reason: "allowlist" }
  | { action: "drop"; reason: "disabled" | "allowlist-only" | "no-policy" }
  | { action: "pair"; reason: "pairing" };

export function decideDm(senderId: string, access: Access): DmDecision {
  if (access.dmPolicy === "disabled") return { action: "drop", reason: "disabled" };
  if (access.allowFrom.includes(senderId)) return { action: "deliver", reason: "allowlist" };
  if (access.dmPolicy === "allowlist") return { action: "drop", reason: "allowlist-only" };
  if (access.dmPolicy === "pairing") return { action: "pair", reason: "pairing" };
  return { action: "drop", reason: "no-policy" };
}

export type GroupDecision =
  | { action: "deliver" }
  | { action: "drop"; reason: "not-enabled" | "not-mentioned" | "sender-blocked" };

export function decideGroupMessage(
  channelId: string,
  senderId: string,
  hasMention: boolean,
  access: Access,
): GroupDecision {
  const policy = access.groups[channelId];
  if (!policy) return { action: "drop", reason: "not-enabled" };
  if (policy.allowFrom.length > 0 && !policy.allowFrom.includes(senderId)) {
    return { action: "drop", reason: "sender-blocked" };
  }
  if (policy.requireMention && !hasMention) {
    return { action: "drop", reason: "not-mentioned" };
  }
  return { action: "deliver" };
}

const PAIRING_ALPHABET = "abcdefghijkmnopqrstuvwxyz"; // no 'l'

export function generatePairingCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(rng() * PAIRING_ALPHABET.length);
    code += PAIRING_ALPHABET.charAt(idx % PAIRING_ALPHABET.length);
  }
  return code;
}
