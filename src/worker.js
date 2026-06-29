/*
 * Cloudflare Worker — serve static assets and proxy /api/* to the backend.
 * Browsers block HTTP API calls from HTTPS pages; the worker fetches server-side.
 * NOTE: Cloudflare Workers cannot fetch raw IP URLs (error 1003) — use a hostname.
 *
 * /api/price is enriched with daily change vs the UTC day-open reference stored in
 * the default cache (updated on every price fetch + scheduled cron).
 */
const BACKEND = "http://api.auremai-software.com:8000";
const PRICE_STATE_URL = "https://auremai.internal/v1/xau-daily-ref";

async function fetchBackendPrice() {
  const res = await fetch(`${BACKEND}/api/price`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);
  return res.json();
}

async function loadPriceState(cache) {
  const res = await cache.match(PRICE_STATE_URL);
  if (!res) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function savePriceState(cache, state) {
  await cache.put(
    PRICE_STATE_URL,
    new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  );
}

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function updatePriceState(cache, price, backendBody) {
  const today = utcDateKey();
  let state = (await loadPriceState(cache)) || {};

  if (state.utcDate !== today || typeof state.dayOpen !== "number") {
    let dayOpen;
    if (state.utcDate && state.utcDate !== today && typeof state.lastPrice === "number") {
      dayOpen = state.lastPrice;
    } else if (typeof backendBody?.day_open === "number" && backendBody.day_open > 0) {
      dayOpen = backendBody.day_open;
    } else if (typeof backendBody?.previous_close === "number" && backendBody.previous_close > 0) {
      dayOpen = backendBody.previous_close;
    } else if (typeof state.dayOpen === "number" && state.utcDate === today) {
      dayOpen = state.dayOpen;
    } else {
      dayOpen = price;
    }
    state = { utcDate: today, dayOpen, lastPrice: price };
  } else {
    state.lastPrice = price;
  }

  await savePriceState(cache, state);
  return state;
}

function buildDailyStats(body, dayOpen) {
  const price = body.price;
  const previousClose = dayOpen;
  const change = Number((price - previousClose).toFixed(2));
  const changePct =
    previousClose > 0 ? Number(((change / previousClose) * 100).toFixed(3)) : 0;

  return {
    ...body,
    price,
    previous_close: previousClose,
    day_open: previousClose,
    change,
    change_pct: changePct,
  };
}

async function enrichPrice(body, cache) {
  if (typeof body?.price !== "number") return body;
  const state = await updatePriceState(cache, body.price, body);
  return buildDailyStats(body, state.dayOpen);
}

async function snapshotPrice(cache) {
  const body = await fetchBackendPrice();
  if (typeof body?.price !== "number") return;
  await updatePriceState(cache, body.price, body);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cache = caches.default;

    if (url.pathname.startsWith("/api/")) {
      const target = `${BACKEND}${url.pathname}${url.search}`;
      try {
        const res = await fetch(target, {
          method: request.method,
          headers: { accept: "application/json" },
        });
        let body = await res.json();
        if (url.pathname === "/api/price") {
          body = await enrichPrice(body, cache);
        }
        return new Response(JSON.stringify(body), {
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

  async scheduled(event, env, ctx) {
    ctx.waitUntil(snapshotPrice(caches.default));
  },
};
