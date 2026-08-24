// Moderation rules. Pure logic.
// Content submission passes through these checks before going live.

import type { Content } from "../types";

export interface ModerationVerdict {
  allowed: boolean;
  reason?: string;
  flags: string[];
}

const BLOCKED_HOSTS = [
  "spam.example", "malware.test",
];

const BANNED_WORDS = [
  "csam", "pedo", // crude but necessary guardrails
];

export function moderateContent(content: {
  url: string;
  title: string;
  description?: string;
}): ModerationVerdict {
  const flags: string[] = [];
  const text = `${content.title} ${content.description || ""}`.toLowerCase();

  // blocked hosts
  try {
    const host = new URL(content.url).hostname.toLowerCase();
    if (BLOCKED_HOSTS.some(h => host.includes(h))) {
      return { allowed: false, reason: "blocked_host", flags: ["blocked_host"] };
    }
  } catch { /* ignore parse errors */ }

  // banned words
  for (const w of BANNED_WORDS) {
    if (text.includes(w)) {
      return { allowed: false, reason: `banned_word:${w}`, flags: ["banned_word"] };
    }
  }

  // rate-based heuristics (would be ML in production)
  if (content.title.length > 200) flags.push("long_title");
  if (text.includes("http") && (text.match(/http/g) || []).length > 3) flags.push("link_spam");

  return { allowed: true, flags };
}

export function shouldAutoFlag(content: Content): boolean {
  return content.status === "flagged";
}
