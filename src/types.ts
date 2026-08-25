export type Site = "reddit" | "youtube";
export type Modes = "blockfull" | "whitelist" | "blacklist" | "none";

export interface RedditSettings {
  mode: Modes;
}

export interface YoutubeSettings {
  mode: Modes;
  list: string[];
  /** Feature ids from FEATURES that are switched off. Absent means enabled. */
  disabled: string[];
}

export interface SiteSettings {
  reddit: RedditSettings;
  youtube: YoutubeSettings;
}

export interface StorageData {
  sites: SiteSettings;
}
