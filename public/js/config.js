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
const COMMUNITY_TELEGRAM_URL = "https://t.me/+F5bnXj-wqW0wZTBk";

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

// Confirmed monthly return % — used by the equity chart fallback only.
// The monthly P&L table always reads live rows from GET /api/performance/monthly.
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

/**
 * Pricing tiers — edit prices and paste Stripe Payment Links below.
 * stripeUrl: full https://buy.stripe.com/… link (leave "" until ready).
 */
const PRICING_TIERS = [
  {
    id: "starter",
    label: "Starter",
    min: 500,
    max: 2499,
    monthly: 39,
    description: "Automate your gold trading from day one",
    stripeUrl: "https://buy.stripe.com/6oUdR8dHRaCd78q7Lsawo00",
  },
  {
    id: "growth",
    label: "Growth",
    min: 2500,
    max: 9999,
    monthly: 69,
    description: "Consistent performance for growing accounts",
    stripeUrl: "https://buy.stripe.com/7sYbJ08nx39LboG1n4awo03",
  },
  {
    id: "plus",
    label: "Plus",
    min: 10000,
    max: 24999,
    monthly: 149,
    description: "Advanced money management on mid-size capital",
    stripeUrl: "https://buy.stripe.com/8x2aEW6fpdOp1O68Pwawo04",
  },
  {
    id: "pro",
    label: "Pro",
    min: 25000,
    max: 49999,
    monthly: 249,
    description: "Professional grade automation for serious traders",
    featured: true,
    stripeUrl: "https://buy.stripe.com/fZubJ09rB39LcsKghYawo05",
  },
  {
    id: "elite",
    label: "Elite",
    min: 50000,
    max: null,
    monthly: 499,
    description: "Maximum performance for large capital accounts",
    stripeUrl: "https://buy.stripe.com/dRmfZg8nxfWx0K25Dkawo06",
  },
  {
    id: "institutional",
    label: "Institutional",
    min: 100000,
    max: null,
    monthly: null,
    description: "Custom setup for funds and professional traders",
    contact: true,
  },
];
