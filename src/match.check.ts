import assert from "node:assert/strict";
import {
  channelFromRows,
  isBlockedPath,
  normaliseChannel,
  shouldHideTile,
} from "./match.ts";

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
