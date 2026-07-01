/*
 * AuremAI — site configuration.
 * Single source of truth for the live backend and external links.
 */

// Local dev: hit the backend directly. Production (HTTPS): same-origin /api via Worker proxy.
const isLocalHost =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1");
const API_BASE = isLocalHost ? "http://84.55.8.245:8000" : "";

const TELEGRAM_URL = "https://t.me/auremAIsupport";
const TELEGRAM_HANDLE = "@auremAIsupport";

// TODO: replace with your VT Markets IB / affiliate registration link when ready.
const VT_MARKETS_PARTNER_URL = "https://www.vtmarkets.com/";

// Polling cadences (ms). Price/bias are fast; the rest are slower.
const POLL = {
  price: 20000,
  bias: 20000,
  performance: 60000,
  history: 120000,
  monthly: 120000,
  daily: 120000,
  news: 120000,
};

// Confirmed monthly return % (on balance at month start). Add keys as real data arrives.
const REAL_MONTHLY_RETURN_PCT = {
  "2026-01": 17.67,
  "2026-02": 17.68,
  "2026-03": 13.32,
  "2026-04": 13.76,
  "2026-05": 14.78,
  "2026-06": 23.08,
};

// Max floating drawdown shown on the equity line (never above this %).
const MAX_CHART_DRAWDOWN_PCT = 10;
