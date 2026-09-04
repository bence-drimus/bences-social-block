// Guards over the release metadata, run by `npm run check` alongside match.check.ts.
// Separate file because it needs node:fs, which the app tsconfig project has no types for.
// Paths are resolved from this module rather than cwd, so it does not care where it is run.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { FEATURES } from "./features.ts";
import { siteFromHostname } from "./match.ts";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const manifest = JSON.parse(read("../manifest.json"));
const pkg = JSON.parse(read("../package.json"));

// The version is spliced in from package.json by the vite plugin. A second copy here is
// how AMO ends up with a permanently burned version string.
assert.ok(
  !("version" in manifest),
  "manifest.json must carry no version key - it comes from package.json",
);
assert.ok(
  !existsSync(new URL("../public/manifest.json", import.meta.url)),
  "public/ is copied verbatim, so a manifest there would race the generated one",
);

// Chrome's rules: one to four dot-separated integers, no leading zeros, each <= 65535.
// AMO is looser, so Chrome's are the binding ones.
assert.match(pkg.version, /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/);
for (const part of pkg.version.split(".")) {
  assert.ok(Number(part) <= 65535, `version part ${part} exceeds 65535`);
}

// Store limits. The description was 140 characters before release, which is a hard upload
// rejection rather than a truncation.
assert.ok(
  manifest.description.length <= 132,
  `description is ${manifest.description.length} chars, Chrome allows 132`,
);
assert.ok(manifest.name.length <= 45, "name over Chrome's 45 char limit");
assert.ok(
  manifest.short_name.length <= 12,
  "short_name over Chrome's 12 char limit",
);

// The most dangerous silent edit in the repo: changing this orphans the AMO listing along
// with its users and reviews, irreversibly. It has nothing to do with the display name.
assert.equal(
  manifest.browser_specific_settings.gecko.id,
  "bences-social-block@bence-drimus",
);

// AMO rejects the upload outright without this key. "none" states that nothing is
// collected or transmitted, and Mozilla does not allow it alongside any category.
const collection =
  manifest.browser_specific_settings.gecko.data_collection_permissions;
assert.ok(collection, "gecko.data_collection_permissions is required by AMO");
assert.ok(
  Array.isArray(collection.required) && collection.required.length > 0,
  "data_collection_permissions.required must list at least one value",
);
assert.ok(
  !collection.required.includes("none") || collection.required.length === 1,
  '"none" cannot be combined with a data category',
);

// querySelectorAll throws on an unsupported :has(), so the content script dies outright on
// Firefox below 121 - it does not merely filter less. Derived from the selectors rather
// than hardcoded, so dropping :has() everywhere would free the floor honestly.
const strictMin = manifest.browser_specific_settings.gecko.strict_min_version;
const usesHas = Object.values(FEATURES)
  .flat()
  .some((f) => f.hide?.includes(":has("));
assert.ok(
  !usesHas || parseFloat(strictMin) >= 121,
  `:has() needs Firefox 121 or newer, manifest says ${strictMin}`,
);

// Icons are committed rather than built, so check they are real PNGs of the right size -
// that is what makes a rasteriser-free pipeline safe. Bytes 16-23 of a PNG are the IHDR
// width and height.
for (const size of [16, 32, 48, 128]) {
  const rel = manifest.icons[String(size)];
  assert.equal(rel, `icons/icon-${size}.png`);
  const file = new URL(`../public/${rel}`, import.meta.url);
  assert.ok(existsSync(file), `missing ${rel}`);
  const bytes = readFileSync(file);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${rel} is not a PNG`,
  );
  assert.equal(bytes.readUInt32BE(16), size, `${rel} has the wrong width`);
  assert.equal(bytes.readUInt32BE(20), size, `${rel} has the wrong height`);
}

// A typo'd match pattern injects nothing, silently, forever. endsWith() in
// siteFromHostname handles the leading wildcard without any stripping.
for (const script of manifest.content_scripts) {
  for (const pattern of script.matches) {
    const host = pattern.split("://")[1].split("/")[0];
    assert.ok(
      siteFromHostname(host),
      `no site owns the match pattern ${pattern}`,
    );
  }
}

console.log("release metadata ok");
