import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Serves assets/music over /music in development.
 *
 * The music deliberately lives outside `public/`: anything in there is copied
 * into `dist/`, and Tauri embeds `dist/` into the executable. Sixty-eight
 * megabytes of background track has no business inside a binary that is
 * otherwise about ten. In a packaged build the same file is shipped beside the
 * application as a Tauri resource; this plugin is the development equivalent.
 *
 * Range requests are honoured so the browser streams rather than downloading
 * the whole file before playing a note.
 */
function serveMusic(): Plugin {
  const dir = resolve(__dirname, "assets/music");

  return {
    name: "keyblade-serve-music",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/music", (request, response, next) => {
        const name = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/^\//, "");
        // Nothing but a bare filename: no traversal out of the music directory.
        if (name === "" || name.includes("/") || name.includes("\\") || name.includes("..")) {
          next();
          return;
        }

        const file = resolve(dir, name);
        let size: number;
        try {
          size = statSync(file).size;
        } catch {
          next();
          return;
        }

        const range = request.headers.range;
        if (range === undefined) {
          response.writeHead(200, {
            "Content-Type": "audio/mpeg",
            "Content-Length": size,
            "Accept-Ranges": "bytes",
          });
          createReadStream(file).pipe(response);
          return;
        }

        const [rawStart, rawEnd] = range.replace(/bytes=/, "").split("-");
        const start = Number.parseInt(rawStart, 10) || 0;
        const end = rawEnd === "" ? size - 1 : Math.min(Number.parseInt(rawEnd, 10), size - 1);

        response.writeHead(206, {
          "Content-Type": "audio/mpeg",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
        });
        createReadStream(file, { start, end }).pipe(response);
      });
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), serveMusic()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
