/*
 * Thin fetch wrapper around the AuremAI backend.
 * Every call degrades gracefully: on failure it returns null and lets the
 * caller render a "data unavailable" state rather than throwing.
 */

async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

const api = {
  price: () => apiGet("/api/price"),
  bias: () => apiGet("/api/bias"),
  news: () => apiGet("/api/news"),
  performance: () => apiGet("/api/performance"),
  history: () => apiGet("/api/performance/history"),
  monthly: () => apiGet("/api/performance/monthly"),
  daily: () => apiGet("/api/performance/daily"),
};

/**
 * Poll `fn` immediately and then on `interval`. Returns a stop() function.
 * The first run is awaited so the caller can show an initial state quickly.
 */
function poll(fn, interval) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    await fn();
  };
  tick();
  const id = setInterval(tick, interval);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
