export type Site = "reddit" | "youtube" | "facebook";
export type Modes = "blockfull" | "whitelist" | "blacklist" | "none";

export interface RedditSettings {
  mode: Modes;
  /** No features defined for Reddit yet, but the shape is shared by every site. */
  disabled: string[];
}

export interface YoutubeSettings {
  mode: Modes;
  list: string[];
  /** Feature ids from FEATURES that are switched off. Absent means enabled. */
  disabled: string[];
}

/** No channel filtering yet, so the only modes that do anything are none and blockfull. */
export interface FacebookSettings {
  mode: Modes;
  /** Feature ids from FEATURES.facebook that are switched off. Absent means enabled. */
  disabled: string[];
}

export interface SiteSettings {
  reddit: RedditSettings;
  youtube: YoutubeSettings;
  facebook: FacebookSettings;
}

export interface StorageData {
  sites: SiteSettings;
}
