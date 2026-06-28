/*
 * AuremAI — front-end behaviour.
 * Binds the live backend to the DOM, polling on the cadences in config.js
 * and degrading to a "data unavailable" state whenever a call fails.
 */

/* ------------------------------- helpers ------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmtUSD = (n, dp = 2) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "—";

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/* ------------------------------- price ------------------------------- */
async function refreshPrice() {
  const data = await api.price();
  const priceEls = $$("[data-price]");
  const changeEl = $("[data-change]");

  if (!data || typeof data.price !== "number") {
    priceEls.forEach((el) => (el.textContent = "unavailable"));
    if (changeEl) {
      changeEl.textContent = "Live price unavailable";
      changeEl.className = "ticker__change";
    }
    return;
  }

  priceEls.forEach((el) => (el.textContent = `$${fmtUSD(data.price)}`));

  if (changeEl) {
    const ch = data.change ?? 0;
    const pct = data.change_pct;
    const sign = ch > 0 ? "+" : "";
    const pctTxt = typeof pct === "number" ? ` (${sign}${pct.toFixed(2)}%)` : "";
    changeEl.textContent = `${sign}${fmtUSD(ch)}${pctTxt} today`;
    changeEl.className = "ticker__change " + (ch > 0 ? "is-up" : ch < 0 ? "is-down" : "");
  }
}

/* ------------------------------- bias gauge ------------------------------- */
const GAUGE_LEN = 251.3; // path length of the 160px semicircle arc

async function refreshBias() {
  const data = await api.bias();
  const fill = $("[data-gauge-fill]");
  const needle = $("[data-gauge-needle]");
  const label = $("[data-bias-label]");
  const meta = $("[data-bias-meta]");
  const dirEl = $("[data-directional]");
  const strEl = $("[data-strength]");
  const updatedEl = $("[data-bias-updated]");

  if (fill) fill.style.strokeDasharray = GAUGE_LEN;

  if (!data || typeof data.directional_score !== "number") {
    if (label) { label.textContent = "unavailable"; label.removeAttribute("data-state"); }
    if (meta) meta.textContent = "Signal feed unavailable";
    if (dirEl) dirEl.textContent = "—";
    if (strEl) strEl.textContent = "—";
    if (fill) fill.style.strokeDashoffset = GAUGE_LEN;
    return;
  }

  const score = Math.max(0, Math.min(100, data.directional_score));
  const bias = (data.bias || "neutral").toLowerCase();

  // Needle sweeps from -90deg (score 0) to +90deg (score 100).
  if (needle) needle.style.transform = `rotate(${(score / 100) * 180 - 90}deg)`;
  if (fill) {
    fill.style.strokeDashoffset = GAUGE_LEN * (1 - score / 100);
    fill.style.stroke =
      bias === "bullish" ? "var(--bull)" : bias === "bearish" ? "var(--bear)" : "var(--neutral)";
  }
  if (label) { label.textContent = bias; label.setAttribute("data-state", bias); }
  if (meta) meta.textContent = `Based on ${data.based_on_items ?? "—"} recent items`;
  if (dirEl) dirEl.textContent = score.toFixed(1);
  if (strEl) strEl.textContent =
    typeof data.strength_abs === "number" ? `${data.strength_abs.toFixed(1)}/100` : "—";
  if (updatedEl && data.updated_at) updatedEl.textContent = `Updated ${timeAgo(data.updated_at)}.`;
}

/* ------------------------------- performance ------------------------------- */
async function refreshPerformance() {
  const data = await api.performance();
  const equityEl = $("[data-equity]");
  const balanceEl = $("[data-balance]");
  const updatedEl = $("[data-perf-updated]");
  const statusEl = $("[data-perf-status]");
  const staleEl = $("[data-stale]");

  if (!data || !data.available) {
    [equityEl, balanceEl].forEach((el) => el && (el.textContent = "unavailable"));
    if (updatedEl) updatedEl.textContent = "—";
    if (statusEl) { statusEl.textContent = "Account feed unavailable"; statusEl.className = "stat-card__status"; }
    if (staleEl) staleEl.hidden = true;
    return;
  }

  if (equityEl) equityEl.textContent = `$${fmtUSD(data.equity)}`;
  if (balanceEl) balanceEl.textContent = `$${fmtUSD(data.balance)}`;
  if (updatedEl) updatedEl.textContent = data.ea_reported_at || timeAgo(data.checked_at);

  if (staleEl) staleEl.hidden = !data.stale;
  if (statusEl) {
    statusEl.textContent = data.stale ? "Stale — awaiting refresh" : "Live";
    statusEl.className = "stat-card__status " + (data.stale ? "is-stale" : "is-live");
  }
}

/* ------------------------------- history chart ------------------------------- */
const SVG_NS = "http://www.w3.org/2000/svg";

async function refreshHistory() {
  const data = await api.history();
  const svg = $(".chart__svg");
  const empty = $("[data-chart-empty]");
  if (!svg) return;

  if (!Array.isArray(data) || data.length < 2) {
    if (empty) { empty.hidden = false; empty.textContent = "History unavailable"; }
    return;
  }
  if (empty) empty.hidden = true;

  const W = 800, H = 280, padL = 8, padR = 8, padT = 16, padB = 16;
  const pts = data
    .map((d) => ({ t: new Date(d.timestamp).getTime(), e: d.equity, b: d.balance }))
    .filter((d) => !Number.isNaN(d.t));

  const vals = pts.flatMap((d) => [d.e, d.b]).filter((v) => typeof v === "number");
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  min -= span * 0.08;
  max += span * 0.08;

  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, tSpan = t1 - t0 || 1;
  const x = (t) => padL + ((t - t0) / tSpan) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = (key) =>
    pts.map((d, i) => `${i ? "L" : "M"}${x(d.t).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");

  const equityPath = line("e");
  const areaPath = `${equityPath} L${x(t1).toFixed(1)} ${H - padB} L${x(t0).toFixed(1)} ${H - padB} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--gold-500)" stop-opacity="0.28" />
        <stop offset="100%" stop-color="var(--gold-500)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#eqFill)" />
    <path d="${line("b")}" fill="none" stroke="var(--green-600)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
    <path d="${equityPath}" fill="none" stroke="var(--gold-500)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
  `;

  if (window.AuremScroll?.bindChartDraw) {
    window.AuremScroll.bindChartDraw(svg);
  }
}

/* ------------------------------- news ------------------------------- */
const escapeHtml = (s = "") =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CAT_LABEL = {
  fed_policy: "Fed policy",
  key_macro: "Key macro",
  major_geopolitics: "Geopolitics",
  secondary_macro: "Secondary macro",
  general: "General",
};

const BIAS_ARROW = { bullish: "▲", bearish: "▼", neutral: "●" };

function bindNewsRail() {
  const scroller = $("[data-news]");
  const fill = $(".news__rail-fill");
  if (!scroller || !fill) return;

  const update = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    fill.style.height = max > 0 ? `${(scroller.scrollTop / max) * 100}%` : "0%";
  };

  if (scroller._newsRailHandler) {
    scroller.removeEventListener("scroll", scroller._newsRailHandler);
  }
  scroller._newsRailHandler = update;
  scroller.addEventListener("scroll", update, { passive: true });
  update();
}

async function refreshNews() {
  const data = await api.news();
  const list = $("[data-news]");
  if (!list) return;

  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    list.innerHTML = `<p class="news__empty">News feed unavailable right now — check back shortly.</p>`;
    bindNewsRail();
    return;
  }

  const items = [...data.items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  list.innerHTML = `<div class="news__list">${items
    .map((item) => {
      const bias = (item.bias || "neutral").toLowerCase();
      const cat = (CAT_LABEL[item.category] || "News").toUpperCase();
      const arrow = BIAS_ARROW[bias] || BIAS_ARROW.neutral;
      return `
        <article class="news-item" data-bias="${bias}">
          <span class="news-item__rail" aria-hidden="true"></span>
          <div class="news-item__body">
            <div class="news-item__meta">
              <span class="news-item__cat">${cat}</span>
              <span class="news-item__bias" data-bias="${bias}">${arrow} ${bias}</span>
              <span class="news-item__time">${timeAgo(item.timestamp)}</span>
            </div>
            <h3 class="news-item__title">${escapeHtml(item.title || "")}</h3>
            <p class="news-item__summary">${escapeHtml(item.summary || "")}</p>
            <p class="news-item__source">${escapeHtml(item.source || "")}</p>
          </div>
        </article>`;
    })
    .join("")}</div>`;

  list.scrollTop = 0;
  bindNewsRail();

  if (window.AuremScroll?.registerNewsItems) {
    window.AuremScroll.registerNewsItems($$(".news-item", list));
  }
}

/* ------------------------------- wiring ------------------------------- */
function wireBullFallback() {
  /* Genie bull uses canvas only — no inline mascot images to wire */
}

function wireStaticLinks() {
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  $$("[data-telegram]").forEach((el) => (el.href = TELEGRAM_URL));

  // Checkout CTAs handled by motion.js (macro confirm → Telegram).
}

document.addEventListener("DOMContentLoaded", () => {
  wireBullFallback();
  wireStaticLinks();
  poll(refreshPrice, POLL.price);
  poll(refreshBias, POLL.bias);
  poll(refreshPerformance, POLL.performance);
  poll(refreshHistory, POLL.history);
  poll(refreshNews, POLL.news);
});
