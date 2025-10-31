import { defineConfig } from "vite";
import { vitePlugin as remix } from "@remix-run/dev";
import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy } from "@remix-run/dev";
import path from "path";

export default defineConfig({
  resolve: {
    mainFields: ["browser", "module", "main"],
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  plugins: [
    // Only enable Cloudflare dev proxy in development mode
    process.env.NODE_ENV !== 'production' && remixCloudflareDevProxy(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
  ].filter(Boolean),
  ssr: {
    resolve: {
      conditions: ["workerd", "worker", "browser"],
    },
  },
  build: {
    minify: true,
  },
});
