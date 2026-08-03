import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Import the SDK straight from source: edits to src/lib/** hot-reload the app.
      "@journifyio/js-sdk": path.resolve(__dirname, "../src/lib/index.ts"),
    },
  },
  server: {
    host: true,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
