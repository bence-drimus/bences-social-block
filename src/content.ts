import { channelFromRows, shouldHideTile } from "./match";
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

const CHANNEL_HREF = /(?:^|youtube\.com)\/(?:@|channel\/|c\/|user\/)/i;
const OVERLAY_ID = "sb-blocked";
const STYLE_ID = "sb-style";

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
`;

let mode: Modes = "none";
let list: string[] = [];
let bouncedFrom = "";

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

function injectCss() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.documentElement.append(style);
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
function checkWatchPage() {
  const owner = document.querySelector("ytd-watch-metadata #owner");
  if (!owner || !shouldHideTile(channelKeys(owner), mode, list)) return;
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

  for (const tile of document.querySelectorAll(TILE_SELECTORS)) {
    tile.classList.toggle(
      "sb-hide",
      shouldHideTile(channelKeys(tile), mode, list),
    );
  }

  if (location.pathname === "/watch") checkWatchPage();
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
  chrome.storage.local.get("sites", (result: { sites?: SiteSettings }) => {
    mode = result.sites?.youtube?.mode ?? "none";
    list = result.sites?.youtube?.list ?? [];
    apply();
  });
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
    tiles: [...document.querySelectorAll(TILE_SELECTORS)].map((t) => ({
      tag: t.tagName.toLowerCase(),
      keys: channelKeys(t),
      hidden: t.classList.contains("sb-hide"),
    })),
  }),
});
