export type Site = "reddit" | "youtube";
export type Modes = "blockfull" | "whitelist" | "blacklist" | "none";

export interface RedditSettings {
  mode: Modes;
}

export interface YoutubeSettings {
  mode: Modes;
  list: string[];
}

export interface StorageData {
  sites: {
    reddit: RedditSettings;
    youtube: YoutubeSettings;
  };
}
