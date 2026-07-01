/*
 * AuremAI — pricing tiers (static HTML in index.html; config.js holds source of truth).
 * Skips JS render when cards are already in the page.
 */

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector("[data-tier-grid]");
  if (!grid) return;

  grid.querySelectorAll("[data-telegram]").forEach((el) => {
    if (typeof TELEGRAM_URL !== "undefined") el.href = TELEGRAM_URL;
  });

  if (window.AuremScroll?.refreshPricing) window.AuremScroll.refreshPricing();
});
