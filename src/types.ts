export type Site = "reddit" | "youtube";
export type Modes = "blockfull" | "whitelist" | "blacklist" | "none";

export interface RedditSettings {
  mode: Modes;
}

export interface YoutubeSettings {
  mode: Modes;
  list: string[];
}

export interface SiteSettings {
  reddit: RedditSettings;
  youtube: YoutubeSettings;
}

export interface StorageData {
  sites: SiteSettings;
}
