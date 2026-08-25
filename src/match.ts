// .ts extension because this file is also checked by the nodenext project (match.check.ts)
import { FEATURES } from "./features.ts";
import type { Modes } from "./types.ts";

/** `@MKBHD`, `youtube.com/@mkbhd/videos` and `MKBHD` all collapse to `mkbhd`. */
export function normaliseChannel(raw: string): string {
  const s = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?youtube\.com/i, "")
    .replace(/^\//, "")
    .replace(/^(channel|c|user)\//i, "")
    .replace(/^@/, "");
  return s.split(/[/?#]/)[0].trim().toLowerCase();
}

/**
 * `keys` are every channel identifier found on a tile (hrefs and link text).
 * An empty `keys` means we could not tell whose video it is, and such tiles are
 * always left alone - so a stale selector filters less rather than blanking the page.
 */
export function shouldHideTile(
  keys: string[],
  mode: Modes,
  list: string[],
): boolean {
  if (mode !== "whitelist" && mode !== "blacklist") return false;
  if (keys.length === 0) return false;

  const wanted = new Set(list.map(normaliseChannel).filter(Boolean));
  const listed = keys.some((k) => wanted.has(normaliseChannel(k)));
  return mode === "whitelist" ? !listed : listed;
}

/**
 * YouTube's metadata rows carry the channel in row 1 only when a metrics row follows.
 * A tile on a channel's own page has a single row (views + age) and names no channel,
 * so reading row 1 there would hide every video on the page.
 */
export function channelFromRows(rows: string[]): string | null {
  if (rows.length < 2) return null;
  return rows[0].trim() || null;
}

/** True when a disabled feature owns this path, so the page should be blanked. */
export function isBlockedPath(pathname: string, disabled: string[]): boolean {
  return FEATURES.some(
    (f) => f.block && disabled.includes(f.id) && f.block.test(pathname),
  );
}
