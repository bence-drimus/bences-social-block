import { FEATURES } from "./features";
import {
  channelFromRows,
  isBlockedPath,
  shouldHideTile,
} from "./match";
import type { Modes, SiteSettings } from "./types";

// ponytail: YouTube renames these renderers and A/B tests layouts. If filtering stops
// working, check which of these still match in devtools. A stale entry only means we
// filter less - it can never blank the feed, because unknown tiles are left alone.
const TILE_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-playlist-video-renderer",
  "yt-lockup-view-model",
].join(",");

// Shelves that only their heading distinguishes. The title element is read rather than
// the whole <h2>, which would drag in the subtitle and the badge text.
const SHELF = [
  "ytd-rich-section-renderer",
  "ytd-shelf-renderer",
  "ytd-item-section-renderer",
].join(",");
const SHELF_TITLE = "#title,.ytShelfHeaderLayoutTitle";

const CHANNEL_HREF = /(?:^|youtube\.com)\/(?:@|channel\/|c\/|user\/)/i;
// Every channel link in the sidebar guide is a subscription - Home, Shorts, Explore and
// You all point at feed paths. Structural, so it does not care about the UI language.
const GUIDE_SUBS = "ytd-guide-renderer a[href]";
const SUBS_KEY = "sbSubs";
const SUBS_PAGE = "/feed/subscriptions";
const SUBS_ELSEWHERE = "subsElsewhere";
const OVERLAY_ID = "sb-blocked";
const STYLE_ID = "sb-style";
const NOTE_ID = "sb-blocked-note";

const CSS = `
.sb-hide { display: none !important; }
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f0f;
  color: #f1f1f1;
  font: 600 20px/1.4 system-ui, sans-serif;
}
html.sb-blocked-page ytd-page-manager { display: none !important; }
#${NOTE_ID} {
  position: fixed;
  top: 40vh;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 2147483646;
  opacity: 0.6;
  font: 500 16px/1.4 system-ui, sans-serif;
}
`;

let mode: Modes = "none";
let list: string[] = [];
let disabled: string[] = [];
let css = CSS;
let shelfTitles: string[] = [];
let subs: string[] = [];
let bouncedFrom = "";

/**
 * One rule per disabled feature. Separate rules on purpose: a selector this browser cannot
 * parse takes its own rule down with it, not every other feature's as well.
 */
function rebuildCss() {
  const rules = FEATURES.filter((f) => f.hide && disabled.includes(f.id)).map(
    (f) => `${f.hide} { display: none !important; }`,
  );
  css = [CSS, ...rules].join("\n");
  shelfTitles = FEATURES.filter((f) => f.shelfTitle && disabled.includes(f.id)).map(
    (f) => f.shelfTitle as string,
  );
}

// The newer lockup tiles put the channel name in a plain text metadata row rather than a
// link, so hrefs alone find nothing on them. ponytail: selectors to verify in devtools if
// filtering drifts - window.__sb() below prints what each tile resolves to.
const CHANNEL_NAME = "ytd-channel-name";
const METADATA_ROWS = "yt-content-metadata-view-model > div";

/** Every channel identifier on a tile: channel hrefs, link text and the name row. */
function channelKeys(root: Element): string[] {
  const keys: string[] = [];

  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || !CHANNEL_HREF.test(href)) continue;
    keys.push(href);
    const text = a.textContent?.trim();
    if (text) keys.push(text);
  }

  for (const el of root.querySelectorAll(CHANNEL_NAME)) {
    const text = el.textContent?.trim();
    if (text) keys.push(text);
  }

  const rows = [...root.querySelectorAll(METADATA_ROWS)].map(
    (row) => row.textContent ?? "",
  );
  const fromRows = channelFromRows(rows);
  if (fromRows) keys.push(fromRows);

  return keys;
}

/**
 * Subscribed channels, allowed implicitly in whitelist mode. Cached in storage because the
 * guide is not rendered on every page, and an empty read would unhide nothing but hide
 * everything you are subscribed to.
 */
function readSubs() {
  const found = new Set<string>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>(GUIDE_SUBS)) {
    const href = a.getAttribute("href");
    if (!href || !CHANNEL_HREF.test(href)) continue;
    found.add(href);
    const text = a.textContent?.trim();
    if (text) found.add(text);
  }
  if (!found.size) return;
  if (found.size === subs.length && subs.every((c) => found.has(c))) return;
  subs = [...found];
  chrome.storage.local.set({ [SUBS_KEY]: subs });
}

/** Whitelist mode allows the subscriptions on top of the list the popup shows. */
function allowed() {
  return mode === "whitelist" ? [...list, ...subs] : list;
}

function injectCss() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.documentElement.append(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

/** Blank a page whose nav button is switched off, leaving the header and search usable. */
function blockPage() {
  document.documentElement.classList.add("sb-blocked-page");
  for (const video of document.querySelectorAll("video")) video.pause();
  if (document.getElementById(NOTE_ID)) return;
  const note = document.createElement("div");
  note.id = NOTE_ID;
  note.textContent = "Disabled by Social Block";
  document.documentElement.append(note);
}

function unblockPage() {
  document.documentElement.classList.remove("sb-blocked-page");
  document.getElementById(NOTE_ID)?.remove();
}

function blockSite() {
  for (const video of document.querySelectorAll("video")) video.pause();
  if (document.getElementById(OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.textContent = "Blocked by Social Block";
  document.documentElement.append(overlay);
}

/** Bounce off a watch page whose channel is filtered out. */
function checkWatchPage(allow: string[]) {
  const owner = document.querySelector("ytd-watch-metadata #owner");
  if (!owner || !shouldHideTile(channelKeys(owner), mode, allow)) return;
  if (bouncedFrom === location.href) return;
  bouncedFrom = location.href;
  if (history.length > 1) history.back();
  else location.replace("https://www.youtube.com/");
}

function apply() {
  injectCss();

  if (mode === "blockfull") {
    blockSite();
    return;
  }
  document.getElementById(OVERLAY_ID)?.remove();

  if (isBlockedPath(location.pathname, disabled)) {
    blockPage();
    return;
  }
  unblockPage();

  if (shelfTitles.length) {
    for (const shelf of document.querySelectorAll(SHELF)) {
      const title = shelf.querySelector(SHELF_TITLE)?.textContent?.trim();
      shelf.classList.toggle("sb-hide", !!title && shelfTitles.includes(title));
    }
  }

  readSubs();
  const allow = allowed();
  // Subscribed videos are penned into their own feed. Reusing blacklist means "is one of
  // these channels" is the tested comparison, normalising and all.
  const penSubs =
    disabled.includes(SUBS_ELSEWHERE) && !location.pathname.startsWith(SUBS_PAGE);

  for (const tile of document.querySelectorAll(TILE_SELECTORS)) {
    const keys = channelKeys(tile);
    // A channel you listed yourself outranks the pen. Subs are left out of this check on
    // purpose, so the pen still herds the ones you never asked for back to their own page.
    const explicit = !shouldHideTile(keys, "whitelist", list);
    tile.classList.toggle(
      "sb-hide",
      shouldHideTile(keys, mode, allow) ||
        (penSubs && !explicit && shouldHideTile(keys, "blacklist", subs)),
    );
  }

  if (location.pathname === "/watch") checkWatchPage(allow);
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    apply();
  });
}

function loadSettings() {
  chrome.storage.local.get(
    ["sites", SUBS_KEY],
    (result: { sites?: SiteSettings; [SUBS_KEY]?: string[] }) => {
      mode = result.sites?.youtube?.mode ?? "none";
      list = result.sites?.youtube?.list ?? [];
      disabled = result.sites?.youtube?.disabled ?? [];
      if (result[SUBS_KEY]?.length) subs = result[SUBS_KEY];
      rebuildCss();
      apply();
    },
  );
}

loadSettings();
chrome.storage.onChanged.addListener(loadSettings);
// childList only: our own class changes are attribute mutations, so this cannot loop.
// It also covers YouTube's SPA navigation, so no yt-navigate-finish listener is needed.
new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// Calibration knob: run __sb() in the page console to see every tile the filter found,
// the keys it resolved and whether it hid it. Empty keys means the selectors need updating.
Object.assign(window, {
  __sb: () => ({
    mode,
    list,
    subs,
    disabled,
    shelfTitles,
    hiding: FEATURES.filter((f) => f.hide && disabled.includes(f.id)).map((f) => {
      const found = document.querySelectorAll(f.hide as string);
      return {
        id: f.id,
        matched: found.length,
        display: found[0] ? getComputedStyle(found[0]).display : "-",
      };
    }),
    rules: document.getElementById(STYLE_ID)?.textContent?.split("\n").length ?? 0,
    shelves: [...document.querySelectorAll(SHELF)].map((sh) => ({
      title: sh.querySelector(SHELF_TITLE)?.textContent?.trim(),
      hidden: sh.classList.contains("sb-hide"),
    })),
    blocked: isBlockedPath(location.pathname, disabled),
    tiles: [...document.querySelectorAll(TILE_SELECTORS)].map((t) => ({
      tag: t.tagName.toLowerCase(),
      keys: channelKeys(t),
      hidden: t.classList.contains("sb-hide"),
    })),
  }),
});
