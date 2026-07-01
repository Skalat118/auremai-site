/*
 * AuremAI — dynamic pricing tiers from GET /api/tiers
 */

const TIER_DESCRIPTIONS = {
  starter: "Automate your gold trading from day one",
  growth: "Consistent performance for growing accounts",
  plus: "Advanced money management on mid-size capital",
  pro: "Professional grade automation for serious traders",
  elite: "Maximum performance for large capital accounts",
  institutional: "Custom setup for funds and professional traders",
};

function tierKey(id) {
  return String(id || "").toLowerCase();
}

function formatUsdAmount(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatTierRange(min, max) {
  const lo = formatUsdAmount(min);
  const hi = formatUsdAmount(max);
  if (lo == null && hi == null) return "Custom";
  if (hi == null) return `$${lo}+`;
  if (lo == null) return `Up to $${hi}`;
  return `$${lo} to $${hi}`;
}

function tierDescription(tier) {
  return TIER_DESCRIPTIONS[tierKey(tier.id)] || "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPaidTierCard(tier) {
  const id = tierKey(tier.id);
  const name = escapeHtml(tier.label || tier.id || "Plan");
  const range = escapeHtml(formatTierRange(tier.min, tier.max));
  const desc = escapeHtml(tierDescription(tier));
  const monthly = tier.pricing?.monthly;
  const priceHtml =
    monthly == null
      ? `<div class="tier-card__price tier-card__price--contact">Contact us</div>`
      : `<div class="tier-card__price"><span class="tier-card__cur">$</span>${escapeHtml(formatUsdAmount(monthly))}<span class="tier-card__per">/mo</span></div>`;
  const featured = id === "pro" ? " tier-card--featured" : "";
  const badge = id === "pro" ? `<span class="tier-card__badge">Most popular</span>` : "";

  return `
    <article class="tier-card card hover-lift hover-glow${featured}" data-tier-id="${escapeHtml(id)}">
      ${badge}
      <span class="tier-card__range">${range}</span>
      <h3 class="tier-card__name">${name}</h3>
      <p class="tier-card__desc">${desc}</p>
      ${priceHtml}
      <a class="btn ${id === "pro" ? "btn--gold" : "btn--ghost"} btn--block tier-card__cta" href="#" data-tier-cta>Get Started</a>
    </article>
  `;
}

function renderInstitutionalCard(tier) {
  const name = escapeHtml(tier?.label || "Institutional");
  const desc = escapeHtml(tier ? tierDescription(tier) : TIER_DESCRIPTIONS.institutional);
  const range = tier
    ? escapeHtml(formatTierRange(tier.min, tier.max))
    : "$50,000+";

  return `
    <article class="tier-card tier-card--contact card hover-lift hover-glow" data-tier-id="institutional">
      <span class="tier-card__range">${range}</span>
      <h3 class="tier-card__name">${name}</h3>
      <p class="tier-card__desc">${desc}</p>
      <div class="tier-card__price tier-card__price--contact">Contact us</div>
      <a class="btn btn--ghost btn--block tier-card__cta" href="#" data-telegram>Talk to us</a>
    </article>
  `;
}

function sortTiers(tiers) {
  return [...tiers].sort((a, b) => {
    const amin = typeof a.min === "number" ? a.min : 0;
    const bmin = typeof b.min === "number" ? b.min : 0;
    return amin - bmin;
  });
}

async function refreshPricingTiers() {
  const grid = document.querySelector("[data-tier-grid]");
  const status = document.querySelector("[data-tier-status]");
  if (!grid) return;

  if (status) status.textContent = "Loading plans…";

  const data = await api.tiers();
  const tiers = Array.isArray(data?.tiers) ? sortTiers(data.tiers) : null;

  if (!tiers?.length) {
    grid.innerHTML = "";
    if (status) {
      status.hidden = false;
      status.textContent = "Pricing unavailable right now. Message us on Telegram to get started.";
    }
    return;
  }

  const paid = tiers.filter((t) => tierKey(t.id) !== "institutional");
  const institutional = tiers.find((t) => tierKey(t.id) === "institutional");

  grid.innerHTML = paid.map(renderPaidTierCard).join("") + renderInstitutionalCard(institutional);

  if (status) status.hidden = true;

  $$("[data-tier-cta]:not([data-telegram])", grid).forEach((el) => {
    el.addEventListener("click", (e) => e.preventDefault());
  });

  $$("[data-telegram]", grid).forEach((el) => {
    if (typeof TELEGRAM_URL !== "undefined") el.href = TELEGRAM_URL;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(TELEGRAM_URL, "_blank", "noopener");
    });
  });

  if (window.AuremScroll?.refreshPricing) window.AuremScroll.refreshPricing();
  else if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  refreshPricingTiers();
});
