import assert from "node:assert/strict";
import {
  channelFromRows,
  isBlockedPath,
  normaliseChannel,
  shouldHideTile,
  siteFromHostname,
  siteFromUrl,
} from "./match.ts";
import { FEATURES } from "./features.ts";
import { PRESETS } from "./presets.ts";
import { mergeSites } from "./defaults.ts";
import type { Site } from "./types.ts";

assert.equal(siteFromHostname("www.youtube.com"), "youtube");
assert.equal(siteFromHostname("m.youtube.com"), "youtube");
assert.equal(siteFromHostname("youtube.com"), "youtube");
assert.equal(siteFromHostname("WWW.FACEBOOK.COM"), "facebook");
assert.equal(siteFromHostname("web.facebook.com"), "facebook");
assert.equal(siteFromHostname("old.reddit.com"), "reddit");
assert.equal(siteFromHostname("example.com"), null);
assert.equal(siteFromHostname(""), null);
// a lookalike domain is not the site
assert.equal(siteFromHostname("notyoutube.com"), null);
assert.equal(siteFromHostname("facebook.com.evil.test"), null);

console.log("siteFromHostname ok");

assert.equal(siteFromUrl("https://www.youtube.com/watch?v=abc"), "youtube");
assert.equal(siteFromUrl("https://web.facebook.com/"), "facebook");
assert.equal(siteFromUrl("https://example.com/"), null);
// the popup opens on all sorts of tabs, and none of these may throw
assert.equal(siteFromUrl(undefined), null);
assert.equal(siteFromUrl(""), null);
assert.equal(siteFromUrl("chrome://extensions"), null);
assert.equal(siteFromUrl("about:blank"), null);
assert.equal(siteFromUrl("not a url at all"), null);
assert.equal(siteFromUrl("http://"), null);

console.log("siteFromUrl ok");

assert.equal(normaliseChannel("@MKBHD"), "mkbhd");
assert.equal(normaliseChannel("  MKBHD  "), "mkbhd");
assert.equal(
  normaliseChannel("https://www.youtube.com/@mkbhd/videos"),
  "mkbhd",
);
assert.equal(normaliseChannel("/channel/UCabc"), "ucabc");
assert.equal(normaliseChannel("/@mkbhd"), "mkbhd");
assert.equal(normaliseChannel("Marques Brownlee"), "marques brownlee");
assert.equal(normaliseChannel(""), "");

const list = ["@mkbhd"];

assert.equal(shouldHideTile(["/@mkbhd"], "whitelist", list), false);
assert.equal(shouldHideTile(["/@veritasium"], "whitelist", list), true);
assert.equal(shouldHideTile([], "whitelist", list), false);
assert.equal(shouldHideTile(["/@mkbhd"], "blacklist", list), true);
assert.equal(shouldHideTile(["/@veritasium"], "blacklist", list), false);
assert.equal(shouldHideTile([], "blacklist", list), false);
assert.equal(shouldHideTile(["/@veritasium"], "none", list), false);
assert.equal(shouldHideTile(["/@veritasium"], "blockfull", list), false);

// display name on the tile, handle in the list, and the other way round
assert.equal(
  shouldHideTile(["/@mkbhd", "MKBHD"], "blacklist", ["MKBHD"]),
  true,
);
assert.equal(
  shouldHideTile(["/channel/UCabc"], "blacklist", [
    "youtube.com/channel/UCabc",
  ]),
  true,
);

// whitelisting nothing allows nothing
assert.equal(shouldHideTile(["/@mkbhd"], "whitelist", []), true);

console.log("match.ts ok");

assert.equal(
  channelFromRows(["LegacyKillaHD", "86K views · 3 hr ago"]),
  "LegacyKillaHD",
);
assert.equal(channelFromRows(["4.4M views · 15 hours ago"]), null);
assert.equal(channelFromRows([]), null);
assert.equal(channelFromRows(["  ", "86K views"]), null);

console.log("channelFromRows ok");

assert.equal(isBlockedPath("/", [], "youtube"), false);
assert.equal(isBlockedPath("/", ["home"], "youtube"), true);
assert.equal(isBlockedPath("/", ["shortsPage"], "youtube"), false);
assert.equal(isBlockedPath("/shorts/abc123", ["shortsPage"], "youtube"), true);
assert.equal(
  isBlockedPath("/shorts/abc123", ["shortsContent"], "youtube"),
  false,
);
assert.equal(
  isBlockedPath("/feed/subscriptions", ["subscriptions"], "youtube"),
  true,
);
assert.equal(
  isBlockedPath("/watch", ["home", "shortsPage", "subscriptions"], "youtube"),
  false,
);
assert.equal(isBlockedPath("/results", ["home"], "youtube"), false);
// notifications is a dropdown, not a page, so it never blocks anything
assert.equal(isBlockedPath("/", ["notifications"], "youtube"), false);

console.log("isBlockedPath ok");

// Facebook: the Groups rule deliberately stops short of the whole subtree, and the two
// sites' ids must not leak into one another.
assert.equal(isBlockedPath("/groups", ["fbGroups"], "facebook"), true);
assert.equal(isBlockedPath("/groups/feed", ["fbGroups"], "facebook"), true);
assert.equal(isBlockedPath("/groups/discover", ["fbGroups"], "facebook"), true);
assert.equal(isBlockedPath("/groups/1234567", ["fbGroups"], "facebook"), false);
assert.equal(isBlockedPath("/", ["fbHome"], "facebook"), true);
assert.equal(isBlockedPath("/home.php", ["fbHome"], "facebook"), true);
assert.equal(
  isBlockedPath("/marketplace/item/1", ["fbMarketplace"], "facebook"),
  true,
);
assert.equal(isBlockedPath("/reel/123", ["fbReelsPage"], "facebook"), true);
assert.equal(
  isBlockedPath("/watch", ["fbReelsPage", "fbGroups"], "facebook"),
  false,
);
assert.equal(isBlockedPath("/friends", ["fbFriends"], "facebook"), true);
// Memories is labelled one thing and served from another
assert.equal(isBlockedPath("/onthisday", ["fbMemories"], "facebook"), true);
assert.equal(isBlockedPath("/memories", ["fbMemories"], "facebook"), true);
assert.equal(isBlockedPath("/saved", ["fbSaved"], "facebook"), true);
// sidebar-only rows own no page, so they can never blank one
assert.equal(
  isBlockedPath(
    "/",
    [
      "fbMetaAi",
      "fbShortcuts",
      "fbNotifications",
      "fbMessenger",
      "fbMenu",
      "fbContacts",
    ],
    "facebook",
  ),
  false,
);
// youtube's "home" means nothing on facebook, and vice versa
assert.equal(isBlockedPath("/", ["home"], "facebook"), false);
assert.equal(isBlockedPath("/", ["fbHome"], "youtube"), false);

console.log("facebook paths ok");

// A preset id that no longer exists in FEATURES is a dead setting: it would sit in storage
// hiding nothing, with no row in the popup to reveal it.
for (const preset of PRESETS) {
  for (const [site, settings] of Object.entries(preset.sites)) {
    const ids = FEATURES[site as Site].map((f) => f.id);
    for (const id of settings.disabled) {
      assert.ok(
        ids.includes(id),
        `${preset.name}: ${site} has no feature "${id}"`,
      );
    }
  }
}

console.log("presets ok");

// Storage written by an older version is missing whatever did not exist yet. Every one of
// these used to throw while rendering the popup, leaving a 0-height window.
assert.deepEqual(mergeSites(undefined).facebook, {
  mode: "none",
  disabled: [],
});
assert.deepEqual(mergeSites({}).facebook, { mode: "none", disabled: [] });
// a sites object from before facebook existed
assert.deepEqual(mergeSites({ youtube: { mode: "blacklist" } }).facebook, {
  mode: "none",
  disabled: [],
});
// youtube from before the channel list existed keeps its mode and gains the list
assert.deepEqual(mergeSites({ youtube: { mode: "whitelist" } }).youtube, {
  mode: "whitelist",
  list: [],
  disabled: [],
});
// real stored values win over the defaults
assert.deepEqual(
  mergeSites({ facebook: { mode: "blockfull", disabled: ["fbHome"] } })
    .facebook,
  { mode: "blockfull", disabled: ["fbHome"] },
);
// corrupt shapes fall back instead of reaching the UI
assert.deepEqual(mergeSites({ youtube: { list: "nope" } }).youtube.list, []);
assert.deepEqual(mergeSites({ youtube: { list: null } }).youtube.list, []);
assert.deepEqual(
  mergeSites({ facebook: { disabled: {} } }).facebook.disabled,
  [],
);
assert.equal(mergeSites({ facebook: "broken" }).facebook.mode, "none");
// unknown keys are not carried through
assert.ok(!("junk" in mergeSites({ facebook: { junk: 1 } }).facebook));

console.log("mergeSites ok");
