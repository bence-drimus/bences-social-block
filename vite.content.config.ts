import { defineConfig } from "vite";

// A manifest content_script cannot be an ES module, so it gets its own build:
// lib mode with format iife guarantees one self-contained classic script.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/content.ts",
      name: "socialBlock",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
