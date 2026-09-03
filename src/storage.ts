import type { StorageData } from "./types";

const DEFAULT_SETTINGS: StorageData = {
  sites: {
    reddit: { mode: "none", disabled: [] },
    youtube: { mode: "none", list: [], disabled: [] },
    facebook: { mode: "none", disabled: [] },
  },
};

export async function loadSettings(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      "sites",
      (result: { sites?: StorageData["sites"] }) => {
        if (result.sites) {
          resolve({ sites: result.sites });
        } else {
          resolve(structuredClone(DEFAULT_SETTINGS));
        }
      },
    );
  });
}

export async function saveSettings(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ sites: data.sites }, () => {
      resolve();
    });
  });
}
