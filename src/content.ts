import { FEATURES } from "./features";
import {
  channelFromRows,
  isBlockedPath,
  pageHides,
  shouldHideTile,
  siteFromHostname,
} from "./match";
import type { Modes, Site, SiteSettings } from "./types";

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

/**
 * Sections that only their heading distinguishes. The title element is read rather than
 * the whole header, which would drag in subtitles and badge text. Facebook's rail sections
 * are a div wrapping a heading and a list, so `> ul` is what separates one from its own
 * ancestors.
 */
const SHELVES: Record<Site, { container: string; title: string }> = {
  youtube: {
    container:
      "ytd-rich-section-renderer,ytd-shelf-renderer,ytd-item-section-renderer",
    title: "#title,.ytShelfHeaderLayoutTitle",
  },
  facebook: {
    // Unscoped on purpose: the left rail carries no role="navigation" - its landmark is an
    // `h2` - so anchoring there matched nothing. A direct `> ul` child narrows it to list
    // sections, and the heading text below is what actually decides.
    container: "div:has(> ul)",
    title: "h3",
  },
  reddit: { container: "", title: "" },
};

const CHANNEL_HREF = /(?:^|youtube\.com)\/(?:@|channel\/|c\/|user\/)/i;
// Every channel link in the sidebar guide is a subscription - Home, Shorts, Explore and
// You all point at feed paths. Structural, so it does not care about the UI language.
const GUIDE_SUBS = "ytd-guide-renderer a[href]";
const SUBS_KEY = "sbSubs";
// One content script serves both sites: the CSS, page blanking and settings plumbing are
// site-agnostic, and only the tile filtering below is YouTube's.
// The fallback never fires in practice - the manifest only injects us on matched hosts.
const SITE: Site = siteFromHostname(location.hostname) ?? "youtube";

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
html.sb-blocked-page ytd-page-manager,
html.sb-blocked-page div[role="main"] { display: none !important; }
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
// The page YouTube last finished navigating to. Until it does, the old page is on screen.
let settled = location.pathname;
let hiddenShelves = new Set<Element>();

/** The rows for whichever site this injection landed on. */
function features() {
  return FEATURES[SITE];
}

/**
 * One rule per disabled feature. Separate rules on purpose: a selector this browser cannot
 * parse takes its own rule down with it, not every other feature's as well.
 */
function rebuildCss() {
  const rules = features()
    .filter((f) => f.hide && disabled.includes(f.id))
    .map((f) => `${f.hide} { display: none !important; }`);
  css = [CSS, ...rules].join("\n");
  shelfTitles = features()
    .filter((f) => f.shelfTitle && disabled.includes(f.id))
    .map((f) => f.shelfTitle as string);
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
function blockPage(pause: boolean) {
  document.documentElement.classList.add("sb-blocked-page");
  if (pause) for (const video of document.querySelectorAll("video")) video.pause();
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

  const hides = pageHides(location.pathname, settled, disabled, SITE);
  if (hides.blank) {
    // Only pause on the blocked page itself. While the page being left is held blank, a
    // video playing is the new page's, and nothing would start it again.
    blockPage(isBlockedPath(location.pathname, disabled, SITE));
    return;
  }
  unblockPage();

  hideNamedShelves();

  if (SITE === "youtube") applyYoutube(hides.penSubs);
}

/**
 * Sections CSS cannot name, matched on their heading text. A section goes when its first
 * title is a listed one. Found from the headings up rather than from every container down,
 * because Facebook's container selector is a :has() over every div on the page.
 */
function hideNamedShelves() {
  const { container, title } = SHELVES[SITE];
  if (!container) return;
  const next = new Set<Element>();
  if (shelfTitles.length) {
    for (const heading of document.querySelectorAll(title)) {
      const text = heading.textContent?.trim();
      if (!text || !shelfTitles.includes(text)) continue;
      // Once an ancestor has an earlier title, every one above it does too.
      let shelf = heading.parentElement?.closest(container);
      while (shelf?.querySelector(title) === heading) {
        next.add(shelf);
        shelf = shelf.parentElement?.closest(container);
      }
    }
  }
  // Remembered so unticking the last title takes the class back off.
  for (const shelf of hiddenShelves) {
    if (!next.has(shelf)) shelf.classList.remove("sb-hide");
  }
  for (const shelf of next) shelf.classList.add("sb-hide");
  hiddenShelves = next;
}

/** Channel filtering, the subscription pen and the shelf-title hides are YouTube's alone. */
function applyYoutube(penSubs: boolean) {
  const filtering = mode === "whitelist" || mode === "blacklist";
  // This runs on every DOM change, so the guide and the tiles are only read when something
  // will compare against them. Empty keys hide nothing, so the toggle still clears old hides.
  if (mode === "whitelist" || penSubs) readSubs();
  const allow = allowed();

  for (const tile of document.querySelectorAll(TILE_SELECTORS)) {
    const keys = filtering || penSubs ? channelKeys(tile) : [];
    // A channel you listed yourself outranks the pen. Subs are left out of this check on
    // purpose, so the pen still herds the ones you never asked for back to their own page.
    const explicit = !shouldHideTile(keys, "whitelist", list);
    // The pen reuses blacklist, so "is one of these channels" is the tested comparison,
    // normalising and all.
    tile.classList.toggle(
      "sb-hide",
      shouldHideTile(keys, mode, allow) ||
        (penSubs && !explicit && shouldHideTile(keys, "blacklist", subs)),
    );
  }

  if (filtering && location.pathname === "/watch") checkWatchPage(allow);
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
      const site = result.sites?.[SITE];
      mode = site?.mode ?? "none";
      disabled = site?.disabled ?? [];
      list = result.sites?.youtube?.list ?? [];
      if (result[SUBS_KEY]?.length) subs = result[SUBS_KEY];
      rebuildCss();
      apply();
    },
  );
}

loadSettings();
// Settings only. Our own sbSubs cache writes would otherwise reload every open tab, and two
// YouTube tabs whose guides list different subs could keep overwriting each other.
// Firefox also fires this for a set() that changed nothing.
chrome.storage.onChanged.addListener((changes) => {
  const sites = changes.sites;
  if (sites && JSON.stringify(sites.oldValue) !== JSON.stringify(sites.newValue))
    loadSettings();
});
// childList only: our own class changes are attribute mutations, so this cannot loop.
new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
// YouTube fires this for clicks, Back and Forward once the new page is in.
// ponytail: no fallback timer. If leaving a blocked page ever stays blank until a reload,
// check yt-navigate-finish still fires - __sb().settled shows the path it last reported.
document.addEventListener("yt-navigate-finish", () => {
  settled = location.pathname;
  apply();
});

// Calibration knob: run __sb() in the page console to see every tile the filter found,
// the keys it resolved and whether it hid it. Empty keys means the selectors need updating.
Object.assign(window, {
  __sb: () => ({
    site: SITE,
    mode,
    list,
    subs,
    disabled,
    settled,
    shelfTitles,
    hiding: features()
      .filter((f) => f.hide && disabled.includes(f.id))
      .map((f) => {
        const found = document.querySelectorAll(f.hide as string);
        return {
          id: f.id,
          matched: found.length,
          display: found[0] ? getComputedStyle(found[0]).display : "-",
        };
      }),
    rules:
      document.getElementById(STYLE_ID)?.textContent?.split("\n").length ?? 0,
    shelves: SHELVES[SITE].container
      ? [...document.querySelectorAll(SHELVES[SITE].container)].map((sh) => ({
          title: sh.querySelector(SHELVES[SITE].title)?.textContent?.trim(),
          hidden: sh.classList.contains("sb-hide"),
        }))
      : [],
    blocked: pageHides(location.pathname, settled, disabled, SITE).blank,
    tiles: [...document.querySelectorAll(TILE_SELECTORS)].map((t) => ({
      tag: t.tagName.toLowerCase(),
      keys: channelKeys(t),
      hidden: t.classList.contains("sb-hide"),
    })),
  }),
});
