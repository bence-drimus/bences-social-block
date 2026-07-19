import { useState, useEffect } from "react";
import type { Site, SiteSettings } from "../types";
import { loadSettings, saveSettings } from "../storage";

export function useSettings(site: Site) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    loadSettings().then((data) => {
      setSettings(data.sites);
    });
  }, []);

  function updateSiteSettings(update: Partial<SiteSettings[Site]>) {
    if (!settings) return;
    const updated = { ...settings, [site]: { ...settings[site], ...update } };
    setSettings(updated);
  }

  function save() {
    if (!settings) return;
    saveSettings({ sites: settings });
  }

  return { settings, updateSiteSettings, save };
}
