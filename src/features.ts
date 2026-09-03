// .ts extension because this file is also checked by the nodenext project (match.check.ts)
import type { Site } from "./types.ts";

export interface Feature {
  id: string;
  label: string;
  /** Popup grouping. The string is used directly as the fieldset legend. */
  group: string;
  /** Selector list, hidden with CSS while the feature is disabled. */
  hide?: string;
  /** Shelf heading text, hidden with JS while disabled. For shelves CSS cannot name. */
  shelfTitle?: string;
  /** Matched against location.pathname. No entry means the feature has no page. */
  block?: RegExp;
  /**
   * Id of a feature that already covers this one. The popup indents the row under it and
   * locks it on while the parent is ticked. Rows must sit next to their parent in the
   * table - the popup renders them in order.
   */
  parent?: string;
}

/** Sidebar entry in both the full guide and the collapsed mini guide. */
function navEntry(href: string): string {
  return [
    `ytd-guide-entry-renderer:has(a[href="${href}"])`,
    `ytd-mini-guide-entry-renderer:has(a[href="${href}"])`,
  ].join(",");
}

/**
 * Left rail entry, by path fragment. Contains rather than starts-with, because the rail
 * links are absolute - `https://www.facebook.com/groups/?ref=bookmarks` - so a
 * `[href^="/groups"]` matches none of them. The row is an `li`; the bare anchor rule is
 * the fallback for layouts that drop the list.
 */
function fbNav(path: string): string {
  return [
    `li:has(a[href*="${path}"])`,
    `[role="navigation"] a[href*="${path}"]`,
  ].join(",");
}

/**
 * Feed card, by something inside it. Every story in the feed sits in a div carrying
 * aria-posinset, which is the only structural handle on a card - these units are not
 * role="article", and the class names are regenerated per build.
 */
function fbCard(inner: string): string {
  return `div[aria-posinset]:has(${inner})`;
}

/**
 * Top-bar control, by the aria-label on its button. The cell around it goes too, so no gap
 * is left where the icon was; the bare label rule is the fallback if that nesting changes.
 */
function fbBar(label: string): string {
  return [
    `[role="navigation"] > div:has([aria-label="${label}"])`,
    `[aria-label="${label}"]`,
  ].join(",");
}

// ponytail: these selectors are the calibration knob. Both sites rename things - YouTube
// its renderers, Facebook its generated class names - so verify them in devtools when a
// toggle stops working. __sb().hiding in the page console prints how many elements each
// disabled feature matched and whether the rule took. A stale `hide` selector just means
// nothing hides, which is the safe direction; keep every `block` pattern anchored so it
// cannot blank the wrong page.
export const FEATURES: Record<Site, Feature[]> = {
  reddit: [],
  youtube: [
    {
      id: "shortsContent",
      group: "Hide content",
      label: "Shorts videos",
      hide: [
        "ytd-reel-shelf-renderer",
        "ytm-shorts-lockup-view-model",
        "ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)",
        "ytd-rich-shelf-renderer:has(ytm-shorts-lockup-view-model)",
        'ytd-video-renderer:has(a[href^="/shorts"])',
        'yt-lockup-view-model:has(a[href^="/shorts"])',
      ].join(","),
    },
    {
      id: "topicChips",
      group: "Hide content",
      label: "Explore more topics",
      // Structural rather than by heading text, so it survives a UI language change. The
      // yt-chip-cloud-renderer entries are the older layout, kept as a fallback.
      hide: [
        "ytd-rich-section-renderer:has(ytd-chips-shelf-with-video-shelf-renderer)",
        "ytd-chips-shelf-with-video-shelf-renderer",
        "ytd-shelf-renderer:has(yt-chip-cloud-renderer)",
        "ytd-item-section-renderer:has(yt-chip-cloud-renderer)",
      ].join(","),
    },
    {
      id: "topNews",
      group: "Hide content",
      label: "Top news",
      // Nothing in the markup says "news" - the heading is the only signal, so this one
      // is matched by text and breaks if YouTube is set to another language.
      shelfTitle: "Top news",
    },
    {
      id: "subsElsewhere",
      group: "Hide content",
      label: "Subscriptions outside their page",
      // No selector: the content script hides these tiles by channel, since only the
      // subscription list knows which they are. Watch pages stay reachable.
    },
    {
      id: "endscreen",
      group: "Hide content",
      label: "Suggestions on the player",
      // Four different overlays do this: the classic end wall, the newer fullscreen grid,
      // the up-next countdown, the pause overlay, and the creator's end cards. The last
      // entry is the catch-all - every suggestion tile carries it, so a renamed container
      // still ends up empty rather than full.
      hide: [
        ".html5-endscreen",
        ".ytp-endscreen-content",
        ".ytp-fullscreen-grid",
        ".ytp-fullscreen-grid-main-content",
        ".ytp-modern-videowall-still",
        ".ytp-autonav-endscreen-countdown-overlay",
        ".ytp-pause-overlay",
        ".ytp-ce-element",
        ".ytp-suggestion-set",
      ].join(","),
    },
    {
      id: "shortsPage",
      group: "Block pages",
      label: "Shorts page",
      hide: navEntry("/shorts"),
      block: /^\/shorts/,
    },
    {
      id: "home",
      group: "Block pages",
      label: "Home page",
      hide: navEntry("/"),
      block: /^\/$/,
    },
    {
      id: "subscriptions",
      group: "Block pages",
      label: "Subscriptions page",
      hide: navEntry("/feed/subscriptions"),
      block: /^\/feed\/subscriptions/,
    },
    {
      id: "playables",
      group: "Block pages",
      label: "Playables",
      hide: [
        navEntry("/playables"),
        'ytd-rich-section-renderer:has(a[href^="/playables"])',
      ].join(","),
      block: /^\/playables/,
    },
    {
      id: "premium",
      group: "Hide interface",
      label: "Premium upsell",
      hide: [
        navEntry("/premium"),
        "ytd-primetime-promo-renderer",
        'ytd-rich-section-renderer:has(a[href^="/premium"])',
      ].join(","),
      block: /^\/premium/,
    },
    {
      id: "notifications",
      group: "Hide interface",
      label: "Notifications",
      hide: "ytd-notification-topbar-button-renderer",
    },
  ],
  // Ids are prefixed so a stored `disabled` array reads unambiguously - "home" means one
  // thing here and another on YouTube, and both live in the same array shape.
  facebook: [
    {
      id: "fbComposer",
      group: "Hide content",
      label: "Post composer",
      // Two levels up from the region is the card, so hiding it takes the shell with it
      // rather than leaving an empty white bar. Both rules read the aria-label, which
      // means this one breaks if Facebook is set to another language; the region rule is
      // the fallback that at least empties the card.
      hide: [
        'div:has(> div > [aria-label="Create a post"])',
        '[aria-label="Create a post"][role="region"]',
      ].join(","),
    },
    {
      id: "fbStories",
      group: "Hide content",
      label: "Stories",
      // The create-story card is the tray's most reliable landmark. The region rule is the
      // fallback: it empties the tray but leaves the heading, and it depends on the UI
      // language, so it is second.
      hide: [
        fbCard('a[href*="/stories/create"]'),
        '[aria-label="Stories"][role="region"]',
      ].join(","),
    },
    {
      id: "fbReels",
      group: "Hide content",
      label: "Reels in the feed",
      // Any card linking a reel, which also catches a single reel shared as a post.
      hide: [
        fbCard('a[href*="/reel/"]'),
        '[aria-label="Reels"][role="region"]',
      ].join(","),
    },
    {
      id: "fbPymk",
      group: "Hide content",
      label: "People you may know",
      // Every suggestion tile links /friends/suggestions, so this one needs no heading text.
      hide: [
        fbCard('a[href*="/friends/suggestions"]'),
        '[aria-label="People you may know"][role="region"]',
      ].join(","),
    },
    {
      id: "fbHome",
      group: "Block pages",
      label: "Home page",
      // The top-bar tab, not a rail entry. Exact href on purpose - fbNav's contains match
      // would be `[href*="/"]`, which is every link on the page. The li scope keeps it off
      // the logo, which stays as a route back if Facebook drops the tab row.
      hide: 'li:has(a[href="/"])',
      block: /^\/$|^\/home\.php/,
    },
    {
      id: "fbReelsPage",
      group: "Block pages",
      label: "Reels page",
      hide: fbNav("/reel"),
      block: /^\/reel/,
    },
    {
      id: "fbGroups",
      group: "Block pages",
      label: "Groups browse",
      // The browse surfaces only. An individual /groups/<id> you joined on purpose stays
      // readable, so a link from elsewhere does not land on a blank page.
      hide: fbNav("/groups"),
      block: /^\/groups\/?$|^\/groups\/(feed|discover|joins)/,
    },
    {
      id: "fbGaming",
      group: "Block pages",
      label: "Gaming page",
      hide: fbNav("/gaming"),
      block: /^\/(gaming|games)/,
    },
    {
      id: "fbFriends",
      group: "Block pages",
      label: "Friends page",
      hide: fbNav("/friends"),
      block: /^\/friends/,
    },
    {
      id: "fbMemories",
      group: "Block pages",
      label: "Memories page",
      // Labelled Memories, served from /onthisday. The /memories spelling is kept as an
      // alias in case the rename ever reaches the URL.
      hide: [fbNav("/onthisday"), fbNav("/memories")].join(","),
      block: /^\/(onthisday|memories)/,
    },
    {
      id: "fbSaved",
      group: "Block pages",
      label: "Saved page",
      hide: fbNav("/saved"),
      block: /^\/saved/,
    },
    {
      id: "fbMarketplace",
      group: "Block pages",
      label: "Marketplace page",
      hide: fbNav("/marketplace"),
      block: /^\/marketplace/,
    },
    {
      id: "fbMetaAi",
      group: "Hide interface",
      label: "Meta AI",
      // The rail link is an l.facebook.com redirect whose target is URL-encoded, so the
      // only stable fragment in the href is the destination host itself.
      hide: [fbNav("meta.ai"), '[aria-label="Meta AI"]'].join(","),
    },
    {
      id: "fbLeftBar",
      group: "Hide interface",
      label: "Left sidebar",
      // The rail root. Its aria-label depends on the UI language, so the fallback is
      // structural: the site footer lives inside the left rail and nowhere else, which
      // tells this nav apart from the top bar's.
      hide: [
        '[role="navigation"][aria-label="Shortcuts"]',
        '[role="navigation"]:has(footer[role="contentinfo"])',
      ].join(","),
    },
    {
      id: "fbShortcuts",
      group: "Hide interface",
      label: "Your shortcuts",
      parent: "fbLeftBar",
      // Whole section, heading included. Hrefs cannot do it - a shortcut can be an app
      // (apps.facebook.com) or just a Page id - so the h3 text is the only thing naming
      // the section, which means this one breaks if Facebook is set to another language.
      // The href rule stays as a fallback that at least empties the list.
      shelfTitle: "Your shortcuts",
      hide: fbNav("apps.facebook.com"),
    },
    {
      id: "fbNotifications",
      group: "Hide interface",
      label: "Notifications",
      hide: fbBar("Notifications"),
    },
    {
      id: "fbMessenger",
      group: "Hide interface",
      label: "Messenger",
      hide: fbBar("Messenger"),
    },
    {
      id: "fbMenu",
      group: "Hide interface",
      label: "Facebook menu",
      hide: fbBar("Facebook menu"),
    },
    {
      id: "fbContacts",
      group: "Hide interface",
      label: "Contacts sidebar",
      // The whole right rail, by its id - one of the few stable hooks Facebook still has.
      // Group chats sit in the same rail and go with it.
      hide: "#right_rail_container",
    },
  ],
};
