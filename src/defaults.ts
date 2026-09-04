// Settings shape and defaults. Deliberately free of chrome and DOM references so the node
// side can assert on it - .ts extension because that project uses nodenext resolution.
import type { Site, SiteSettings } from "./types.ts";

export const DEFAULT_SETTINGS: SiteSettings = {
  reddit: { mode: "none", disabled: [] },
  youtube: { mode: "none", list: [], disabled: [] },
  facebook: { mode: "none", disabled: [] },
};

/**
 * Stored settings laid over the defaults, one site and one field at a time.
 *
 * Storage accumulates across versions, so a `sites` object written before a site or a
 * field existed is entirely normal. Taking it verbatim meant one missing key threw while
 * rendering the popup, and because the body has no fixed height that left a 280x0 window -
 * indistinguishable from the toolbar icon doing nothing.
 *
 * A stored value is only trusted when its type matches the default's, so a corrupt entry
 * falls back rather than reaching the UI as the wrong shape.
 */
export function mergeSites(stored: unknown): SiteSettings {
  const merged = structuredClone(DEFAULT_SETTINGS);
  if (!stored || typeof stored !== "object") return merged;

  for (const site of Object.keys(merged) as Site[]) {
    const saved = (stored as Record<string, unknown>)[site];
    if (!saved || typeof saved !== "object") continue;

    const target = merged[site] as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined || !(key in target)) continue;
      const fallback = target[key];
      if (Array.isArray(fallback) !== Array.isArray(value)) continue;
      if (typeof fallback !== typeof value) continue;
      target[key] = value;
    }
  }
  return merged;
}
