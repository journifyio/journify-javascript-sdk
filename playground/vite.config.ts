import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const FIXTURE_PATH = path.resolve(__dirname, "fixtures/write-key-settings.json");

// Serves GET /write_keys/<any-key>.json from the local fixture file so the SDK's
// write-key settings fetch works offline. The file is read on every request, so
// editing it takes effect on the next SDK load without restarting the server.
function fakeWriteKeySettings(): Plugin {
  return {
    name: "fake-write-key-settings",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/write_keys/") || !req.url.endsWith(".json")) {
          return next();
        }

        let body: string;
        try {
          body = fs.readFileSync(FIXTURE_PATH, "utf-8");
          JSON.parse(body);
        } catch (e) {
          res.statusCode = 500;
          res.end(`Invalid fixture at ${FIXTURE_PATH}: ${e}`);
          return;
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("X-Client-Country", "MA");
        res.setHeader("Access-Control-Expose-Headers", "X-Client-Country");
        res.end(body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fakeWriteKeySettings()],
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
