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
}

/** Sidebar entry in both the full guide and the collapsed mini guide. */
function navEntry(href: string): string {
  return [
    `ytd-guide-entry-renderer:has(a[href="${href}"])`,
    `ytd-mini-guide-entry-renderer:has(a[href="${href}"])`,
  ].join(",");
}

// ponytail: these selectors are the calibration knob. YouTube renames its renderers, so
// verify them in devtools when a toggle stops working - __sb() in the page console prints
// what is currently disabled. A stale `hide` selector just means nothing hides, which is
// the safe direction; keep every `block` pattern anchored so it cannot blank the wrong page.
export const FEATURES: Feature[] = [
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
      "ytd-rich-section-renderer:has(a[href^=\"/playables\"])",
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
];
