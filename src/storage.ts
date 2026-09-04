import { mergeSites } from "./defaults";
import type { StorageData } from "./types";

export async function loadSettings(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      "sites",
      (result: { sites?: StorageData["sites"] }) => {
        // Merged rather than taken as-is: see mergeSites for why a verbatim read blanked
        // the popup for anyone whose settings predated a site or a field.
        resolve({ sites: mergeSites(result.sites) });
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
