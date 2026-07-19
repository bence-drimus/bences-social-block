import type { StorageData } from "./types";

const DEFAULT_SETTINGS: StorageData = {
  sites: {
    reddit: { mode: "none" },
    youtube: { mode: "none", list: [] },
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
          resolve(DEFAULT_SETTINGS);
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
