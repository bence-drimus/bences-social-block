import { useState, useEffect } from "react";
import type { Site, SiteSettings } from "../types";
import { loadSettings, saveSettings } from "../storage";

export function useSettings() {
  const [sites, setSites] = useState<SiteSettings | null>(null);

  useEffect(() => {
    loadSettings().then((data) => setSites(data.sites));
  }, []);

  // Generic in the site, otherwise Partial<SiteSettings[Site]> collapses to the keys
  // the two sites share ({ mode?: Modes }) and `{ list }` stops typechecking.
  function update<S extends Site>(site: S, patch: Partial<SiteSettings[S]>) {
    if (!sites) return;
    const next: SiteSettings = {
      ...sites,
      [site]: { ...sites[site], ...patch },
    };
    setSites(next);
    saveSettings({ sites: next });
  }

  return { sites, update };
}
