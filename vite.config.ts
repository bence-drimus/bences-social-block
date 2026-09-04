import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The store version lives in exactly one place: package.json. manifest.json carries no
// version key, so `npm version patch` is the whole bump ceremony - it edits, commits and
// tags atomically. That matters because AMO permanently refuses a version string it has
// already accepted, so a half-landed bump cannot be undone.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  // Relative asset paths. Absolute ones happen to resolve against the extension origin
  // root today, but they break the moment an HTML page lives anywhere but dist/ root, and
  // the symptom is a blank popup rather than anything that names the cause.
  base: "./",
  plugins: [
    react(),
    {
      name: "manifest",
      // manifest.json is deliberately not in public/, which copies files verbatim: the
      // version has to be spliced in on the way through.
      generateBundle() {
        const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: JSON.stringify({ ...manifest, version }, null, 2),
        });
      },
    },
  ],
});
