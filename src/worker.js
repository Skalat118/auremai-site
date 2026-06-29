/*
 * Cloudflare Worker — serve static assets and proxy /api/* to the backend.
 * Browsers block HTTP API calls from HTTPS pages; the worker fetches server-side.
 * NOTE: Cloudflare Workers cannot fetch raw IP URLs (error 1003) — use a hostname.
 */
const BACKEND = "http://api.auremai-software.com:8000";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const target = `${BACKEND}${url.pathname}${url.search}`;
      try {
        const res = await fetch(target, {
          method: request.method,
          headers: { accept: "application/json" },
        });
        return new Response(res.body, {
          status: res.status,
          headers: {
            "content-type": res.headers.get("content-type") || "application/json",
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
          },
        });
      } catch {
        return new Response(JSON.stringify({ error: "backend unreachable" }), {
          status: 502,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
