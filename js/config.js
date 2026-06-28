/*
 * AuremAI — site configuration.
 * Single source of truth for the live backend and external links.
 */

// One-line change to point at HTTPS later. NOTE: this is plain HTTP for now —
// browsers block HTTP calls made from an HTTPS-hosted page, so the backend
// must move to HTTPS before this site can go live on https://.
const API_BASE = "http://84.55.8.245:8000";

// TODO: replace with the real AuremAI Telegram handle once confirmed.
const TELEGRAM_URL = "https://t.me/AuremAI";

// Polling cadences (ms). Price/bias are fast; the rest are slower.
const POLL = {
  price: 20000,
  bias: 20000,
  performance: 60000,
  history: 120000,
  news: 120000,
};
