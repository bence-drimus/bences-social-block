import assert from "node:assert/strict";
import { channelFromRows, normaliseChannel, shouldHideTile } from "./match.ts";

assert.equal(normaliseChannel("@MKBHD"), "mkbhd");
assert.equal(normaliseChannel("  MKBHD  "), "mkbhd");
assert.equal(normaliseChannel("https://www.youtube.com/@mkbhd/videos"), "mkbhd");
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
assert.equal(shouldHideTile(["/@mkbhd", "MKBHD"], "blacklist", ["MKBHD"]), true);
assert.equal(shouldHideTile(["/channel/UCabc"], "blacklist", ["youtube.com/channel/UCabc"]), true);

// whitelisting nothing allows nothing
assert.equal(shouldHideTile(["/@mkbhd"], "whitelist", []), true);

console.log("match.ts ok");

assert.equal(channelFromRows(["LegacyKillaHD", "86K views · 3 hr ago"]), "LegacyKillaHD");
assert.equal(channelFromRows(["4.4M views · 15 hours ago"]), null);
assert.equal(channelFromRows([]), null);
assert.equal(channelFromRows(["  ", "86K views"]), null);

console.log("channelFromRows ok");
