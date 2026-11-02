// .ts extension because this file is also checked by the nodenext project (match.check.ts)
import { FEATURES } from "./features.ts";
import type { Modes, Site } from "./types.ts";

/** The hostname that identifies each site. Reddit has no rows yet, but the popup lists it. */
const HOSTS: Record<Site, string> = {
  reddit: "reddit.com",
  youtube: "youtube.com",
  facebook: "facebook.com",
};

/** The site a hostname belongs to, or null when it is none of them. */
export function siteFromHostname(hostname: string): Site | null {
  const host = hostname.toLowerCase();
  const found = (Object.keys(HOSTS) as Site[]).find(
    (site) => host === HOSTS[site] || host.endsWith(`.${HOSTS[site]}`),
  );
  return found ?? null;
}

/**
 * The site a tab URL belongs to, or null. Total by design: a popup that throws while
 * working out which panel to open would unmount itself, and a 0-height popup looks exactly
 * like a dead toolbar icon. Anything unparseable is simply "not one of our sites".
 */
export function siteFromUrl(url: string | undefined): Site | null {
  if (!url) return null;
  try {
    return siteFromHostname(new URL(url).hostname);
  } catch {
    return null;
  }
}

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

// Normalised once per list, not once per tile: the content script asks about every tile on
// every DOM change. ponytail: keyed by array identity, so a list mutated in place would
// read stale - callers replace their arrays rather than push into them.
const normalised = new WeakMap<string[], Set<string>>();

/**
 * `keys` are every channel identifier found on a tile (hrefs and link text), An empty `keys`
 * means we could not tell whose video it is, and such tiles are always left alone - so a
 * stale selector filters less rather than blanking the page.
 */
export function shouldHideTile(
  keys: string[],
  mode: Modes,
  list: string[],
): boolean {
  if (mode !== "whitelist" && mode !== "blacklist") return false;
  if (keys.length === 0) return false;

  let wanted = normalised.get(list);
  if (!wanted) {
    wanted = new Set(list.map(normaliseChannel).filter(Boolean));
    normalised.set(list, wanted);
  }
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

/**
 * True when a disabled feature owns this path, so the page should be blanked. Scoped to
 * one site: ids are per-site tables, and both sites have a home page.
 */
export function isBlockedPath(
  pathname: string,
  disabled: string[],
  site: Site,
): boolean {
  return FEATURES[site].some(
    (f) => f.block && disabled.includes(f.id) && f.block.test(pathname),
  );
}

const SUBS_PAGE = "/feed/subscriptions";
const SUBS_ELSEWHERE = "subsElsewhere";

/**
 * What to hide, given the URL (`current`) and the page still on screen (`settled`). YouTube
 * changes the URL first and swaps the new page in once loaded, so anything hidden on either
 * page stays hidden until then. `penSubs` keeps subscribed videos to their own page. Other
 * sites never report a settled page, so only their URL counts.
 */
export function pageHides(
  current: string,
  settled: string,
  disabled: string[],
  site: Site,
): { blank: boolean; penSubs: boolean } {
  const shown = site === "youtube" ? settled : current;
  const onSubs = (path: string) => path.startsWith(SUBS_PAGE);
  return {
    blank:
      isBlockedPath(current, disabled, site) ||
      isBlockedPath(shown, disabled, site),
    penSubs:
      disabled.includes(SUBS_ELSEWHERE) && !(onSubs(current) && onSubs(shown)),
  };
}
