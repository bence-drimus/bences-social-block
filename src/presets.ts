// .ts extension because this file is also checked by the nodenext project (match.check.ts)
import type { Site, SiteSettings } from "./types.ts";

/**
 * A ready-made configuration. Each preset names only the sites it covers, so applying one
 * leaves every other site untouched.
 *
 * ponytail: presets do not track features.ts. A row added there is simply absent here,
 * which reads as "leave it enabled" - so every new feature needs a decision in this file
 * too, or the preset quietly drifts behind the UI.
 */
export interface Preset {
  name: string;
  sites: Partial<{ [S in Site]: SiteSettings[S] }>;
}

export const PRESETS: Preset[] = [
  {
    name: "Bence's setup",
    sites: {
      facebook: {
        mode: "none",
        // Marketplace stays reachable on purpose. fbShortcuts is left out because
        // fbLeftBar already covers it - listing it would survive unticking the sidebar.
        disabled: [
          "fbComposer",
          "fbStories",
          "fbReels",
          "fbPymk",
          "fbHome",
          "fbReelsPage",
          "fbGroups",
          "fbGaming",
          "fbFriends",
          "fbMemories",
          "fbSaved",
          "fbMetaAi",
          "fbLeftBar",
          "fbNotifications",
          "fbMessenger",
          "fbMenu",
          "fbContacts",
        ],
      },
    },
  },
];
