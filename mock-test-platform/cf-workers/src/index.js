import { handleAuth } from "./auth/index.js";
import { handleSettings } from "./settings/index.js";
import { handleEvents } from "./events/index.js";
import { handleBundleAccess } from "./bundle-access/index.js";
export { BatchDO } from "./events/batch-do.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route to service handlers
    if (path.startsWith("/v1/auth")) return handleAuth(request, env, ctx);
    if (path.startsWith("/v1/settings")) return handleSettings(request, env, ctx);
    if (path.startsWith("/v1/events")) return handleEvents(request, env, ctx);
    if (path.startsWith("/v1/bundle")) return handleBundleAccess(request, env, ctx);

    return new Response("Not Found", { status: 404 });
  },
};
