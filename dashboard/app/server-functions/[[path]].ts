import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
// @ts-expect-error - Server build is copied during build process
import * as build from "./server/index.js";

const handler = createPagesFunctionHandler({
  build,
  getLoadContext: (context) => ({
    // Provide env at top level for direct access
    env: context.env,

    // Also provide under cloudflare namespace for compatibility
    cloudflare: {
      env: context.env,
      cf: context.request?.cf,
      ctx: context.waitUntil?.bind(context),
      caches: caches,
    },
  }),
});

export const onRequest = handler;
