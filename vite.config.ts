import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// base "./" so the built dist/ works from any path (GitHub Pages, a sub-folder, a CDN).
export default defineConfig({
  base: "./",
  plugins: [react()],
  // three.js is most of the bundle; one chunk loads faster here than a split.
  build: { chunkSizeWarningLimit: 900 },
});
