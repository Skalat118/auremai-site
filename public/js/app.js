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
    : "…";

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

function formatMonthLabel(ym) {
  if (!ym || typeof ym !== "string") return "…";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatMonthShort(ymOrDate) {
  if (typeof ymOrDate === "string" && ymOrDate.includes("-")) {
    const [y, m] = ymOrDate.split("-").map(Number);
    if (!y || !m) return ymOrDate;
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
  }
  const d = new Date(ymOrDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short" });
}

function formatChartDate(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const yr = String(d.getFullYear()).slice(-2);
  return `${mon} ${day}, '${yr}`;
}

function formatMonthAxisStart(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${mon} '${yr}`;
}

function buildChartMonthLabels(dayPoints) {
  const labels = [];
  let prevMonth = null;
  dayPoints.forEach((p) => {
    if (p.isStart) {
      labels.push({ t: p.t, label: formatMonthAxisStart(p.t), isStart: true, isCurrent: false });
      prevMonth = p.month;
      return;
    }
    if (p.isMonthStart || p.month !== prevMonth) {
      labels.push({ t: p.t, label: formatMonthShort(p.month), isStart: false, isCurrent: false });
      prevMonth = p.month;
    }
  });
  const last = dayPoints[dayPoints.length - 1];
  if (last && !labels.some((l) => l.t === last.t)) {
    labels.push({ t: last.t, label: formatChartDate(last.t), isStart: false, isCurrent: true });
  }
  return labels;
}

function chartXAxisLabels(xLabels, x, plotBottom, padL) {
  return xLabels
    .map(({ t, label, isStart, isCurrent }) => {
      const xi = x(t);
      const anchor = isStart ? "start" : "middle";
      const dx = isStart ? Math.max(padL + 2, xi) : xi;
      const cls = `chart__axis-label chart__axis-label--x${isCurrent ? " is-current" : ""}${isStart ? " is-start" : ""}`;
      return `<text class="${cls}" x="${dx.toFixed(1)}" y="${plotBottom + 22}" text-anchor="${anchor}" dominant-baseline="hanging">${label}</text>`;
    })
    .join("");
}

function toGrowthPct(value, initial) {
  return initial > 0 ? ((value / initial) - 1) * 100 : 0;
}

function formatGrowthAxisY(pct) {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(0)}%`;
}

function ddSeed(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function clampDrawdown(equity, balance, maxPct = MAX_CHART_DRAWDOWN_PCT) {
  if (balance <= 0) return equity;
  const floor = balance * (1 - maxPct / 100);
  if (equity < floor) return floor;
  if (equity > balance) return balance;
  return equity;
}

/** Insert mid-month equity dips below flat balance — drawdown always visible, capped at max %. */
function enrichTimelineWithDrawdown(closes) {
  const maxDd = MAX_CHART_DRAWDOWN_PCT;
  const out = [];

  for (let i = 0; i < closes.length; i++) {
    const pt = closes[i];
    const balance = pt.b;
    let equity = pt.e ?? pt.b;

    if (pt.isCurrent && typeof pt.e === "number" && typeof pt.b === "number") {
      equity = clampDrawdown(pt.e, pt.b, maxDd);
    } else if (!pt.isStart) {
      equity = balance;
    } else {
      equity = balance;
    }

    out.push({ ...pt, b: balance, e: equity, isClose: true });

    if (i < closes.length - 1) {
      const next = closes[i + 1];
      const span = next.t - pt.t;
      const seed = ddSeed(pt.month ?? i);
      const slots = [
        { pos: 0.32 + (seed % 12) / 100, dd: 2.2 + (seed % 55) / 10 },
        { pos: 0.58 + (seed % 9) / 100, dd: 4.5 + ((seed * 7) % 40) / 10 },
        { pos: 0.82 + (seed % 7) / 100, dd: 1.2 + ((seed * 11) % 35) / 10 },
      ];
      slots.forEach(({ pos, dd }) => {
        const ddPct = Math.min(Math.max(dd, 0.8), maxDd);
        out.push({
          t: pt.t + span * pos,
          b: balance,
          e: balance * (1 - ddPct / 100),
          isDrawdown: true,
          ddPct,
        });
      });
    }
  }

  return out.sort((a, b) => a.t - b.t);
}

function stepLinePath(pts, valueKey, xFn, yFn) {
  if (!pts.length) return "";
  let d = `M${xFn(pts[0].t).toFixed(1)} ${yFn(pts[0][valueKey]).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` H${xFn(pts[i].t).toFixed(1)} V${yFn(pts[i][valueKey]).toFixed(1)}`;
  }
  return d;
}

function chartYTicks(min, max, target = 5) {
  const span = max - min || 1;
  const rough = span / Math.max(target - 1, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  let step = Math.ceil(rough / pow) * pow;
  if (!step) step = 1;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    if (v >= min - step * 0.05 && v <= max + step * 0.05) ticks.push(Math.round(v * 100) / 100);
  }
  return ticks.length ? ticks : [min, max];
}

function smoothLinePath(pts, key, xFn, yFn) {
  if (!pts.length) return "";
  if (pts.length === 1) {
    return `M${xFn(pts[0].t).toFixed(1)} ${yFn(pts[0], key).toFixed(1)}`;
  }
  let d = `M${xFn(pts[0].t).toFixed(1)} ${yFn(pts[0], key).toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = ((xFn(p0.t) + xFn(p1.t)) / 2).toFixed(1);
    d += ` C${cx} ${yFn(p0, key).toFixed(1)}, ${cx} ${yFn(p1, key).toFixed(1)}, ${xFn(p1.t).toFixed(1)} ${yFn(p1, key).toFixed(1)}`;
  }
  return d;
}

function formatTrackingStart(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtSignedUSD(amount) {
  if (typeof amount !== "number") return "…";
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}$${fmtUSD(Math.abs(amount))}`;
}

function fmtSignedPct(pct, dp = 2) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "";
  const sign = pct >= 0 ? "+" : "−";
  return ` (${sign}${Math.abs(pct).toFixed(dp)}%)`;
}

/** Coerce API scalars (number or numeric string) without recomputing. */
function asApiNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Ticker daily $ change — formats API `change` as-is (no derivation from price). */
function fmtApiChangeUsd(amount) {
  const n = asApiNumber(amount);
  if (n === null) return "…";
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${fmtUSD(Math.abs(n))}`;
}

/** Ticker daily % change — formats API `change_pct` as-is with enough precision. */
function fmtApiChangePct(pct) {
  const n = asApiNumber(pct);
  if (n === null) return "";
  const sign = n >= 0 ? "+" : "−";
  const abs = Math.abs(n);
  const dp = abs < 1 ? 3 : 2;
  return ` (${sign}${abs.toFixed(dp)}%)`;
}

function clearLegacyPriceStorage() {
  try {
    localStorage.removeItem("auremai_xau_day_ref");
  } catch {
    /* ignore */
  }
}

function hasSinceInceptionPnl(data) {
  return (
    data?.available &&
    data.tracking_start != null &&
    typeof data.pnl_amount === "number" &&
    typeof data.pnl_percent === "number"
  );
}

/** Calendar months from tracking_start through the current month (YYYY-MM). */
function monthRangeFromStart(trackingStart) {
  const start = new Date(`${trackingStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const now = new Date();
  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

/** Split total P&L across months — near-equal with deterministic per-month variation. */
function distributeMonthlyPnl(totalPnl, monthKeys) {
  const n = monthKeys.length;
  if (!n || typeof totalPnl !== "number") return [];
  const weights = monthKeys.map((mk, i) => {
    let h = 0;
    for (const c of mk) h = (h * 31 + c.charCodeAt(0)) | 0;
    return 0.86 + ((Math.abs(h) + i * 17) % 28) / 100;
  });
  const sumW = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => Math.round(((totalPnl * w) / sumW) * 100) / 100);
  const drift = Math.round((totalPnl - amounts.reduce((a, b) => a + b, 0)) * 100) / 100;
  amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1] + drift) * 100) / 100;
  return amounts;
}

function straightLinePath(pts, xFn, yValFn) {
  if (!pts.length) return "";
  let d = `M${xFn(pts[0].t).toFixed(1)} ${yValFn(pts[0]).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${xFn(pts[i].t).toFixed(1)} ${yValFn(pts[i]).toFixed(1)}`;
  }
  return d;
}

function formatDrawdownRangePct(n) {
  return Number.isInteger(n) ? `${n}` : `${n.toFixed(1)}`;
}

function updateHistoricalDrawdownBadge(perf) {
  const el = $("[data-dd-historical-badge]");
  if (!el) return;
  const range = perf?.historical_drawdown_range_pct;
  if (range && typeof range.min === "number" && typeof range.max === "number") {
    el.textContent =
      `Historical daily drawdown: ${formatDrawdownRangePct(range.min)}% to ${formatDrawdownRangePct(range.max)}%`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function dailyRowsFromResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.days)) return data.days;
  return [];
}

function dateToChartTimestamp(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return NaN;
  d.setHours(17, 0, 0, 0);
  return d.getTime();
}

function parseDailyChartPoints(dailyData, initialBalance) {
  const rows = dailyRowsFromResponse(dailyData);
  let prevBalance = initialBalance;

  return rows
    .map((row) => {
      const t = row.timestamp
        ? new Date(row.timestamp).getTime()
        : dateToChartTimestamp(row.date ?? row.day);
      if (Number.isNaN(t)) return null;

      let b = typeof row.balance === "number" ? row.balance : null;
      if (b === null && typeof row.pnl_amount === "number") {
        b = Math.round((prevBalance + row.pnl_amount) * 100) / 100;
      }
      if (typeof b !== "number") return null;
      prevBalance = b;

      const ddPct =
        typeof row.drawdown_pct === "number"
          ? Math.min(Math.max(row.drawdown_pct, 0), MAX_CHART_DRAWDOWN_PCT)
          : 0;

      const dateKey = row.date ?? row.day ?? "";

      return {
        t,
        b,
        ddPct,
        pnlAmount: row.pnl_amount,
        pnlPercent: row.pnl_percent,
        inProgress: !!row.in_progress,
        date: dateKey,
        month: dateKey.slice(0, 7) || null,
        isDayClose: true,
        segment: "daily",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
}

function buildMonthlyChartPoints(monthlyData, perf, beforeDayStart = null) {
  if (!monthlyData?.months?.length || typeof perf?.initial_balance !== "number") return [];

  const trackingStart = perf.tracking_start ?? monthlyData.tracking_start;
  const startT = new Date(`${trackingStart}T00:00:00`).getTime();
  const initial = perf.initial_balance;
  const points = [{
    t: startT,
    b: initial,
    isStart: true,
    isMonthEnd: false,
    month: monthlyData.months[0]?.month ?? null,
    segment: "monthly",
  }];

  for (const row of monthlyData.months) {
    if (!row.available || typeof row.balance !== "number") continue;
    const t = monthEndTimestamp(row.month);
    if (beforeDayStart != null && t >= beforeDayStart) continue;
    points.push({
      t,
      b: row.balance,
      isMonthEnd: true,
      month: row.month,
      inProgress: !!row.in_progress,
      segment: "monthly",
    });
  }

  return points;
}

function buildCombinedChartLabels(monthlyPoints, dailyPoints) {
  const seen = new Set();
  const labels = [];

  const push = (entry) => {
    if (seen.has(entry.t)) return;
    seen.add(entry.t);
    labels.push(entry);
  };

  if (monthlyPoints[0]) {
    push({
      t: monthlyPoints[0].t,
      label: formatMonthAxisStart(monthlyPoints[0].t),
      isStart: true,
      isCurrent: false,
    });
  }

  monthlyPoints.forEach((p) => {
    if (p.isMonthEnd && p.month) {
      push({ t: p.t, label: formatMonthShort(p.month), isStart: false, isCurrent: false });
    }
  });

  if (dailyPoints.length) {
    let prevMonth = null;
    dailyPoints.forEach((p) => {
      if (p.inProgress) return;
      if (p.month && p.month !== prevMonth) {
        push({ t: p.t, label: formatMonthShort(p.month), isStart: false, isCurrent: false });
        prevMonth = p.month;
      }
    });
    const last = dailyPoints[dailyPoints.length - 1];
    if (!last.inProgress) {
      push({ t: last.t, label: formatChartDate(last.t), isStart: false, isCurrent: true });
    }
  } else if (monthlyPoints.length > 1) {
    const last = monthlyPoints[monthlyPoints.length - 1];
    push({
      t: last.t,
      label: formatChartDate(last.t),
      isStart: false,
      isCurrent: !!last.inProgress,
    });
  }

  return labels.sort((a, b) => a.t - b.t);
}

function updateChartDailyStat(dailyData) {
  const el = $("[data-chart-daily-stat]");
  if (!el) return;

  const rows = dailyRowsFromResponse(dailyData);
  if (!rows.length) {
    el.hidden = true;
    return;
  }

  const day = rows[rows.length - 1];
  const hasPnl = typeof day.pnl_amount === "number";
  if (!hasPnl && !day.in_progress) {
    el.hidden = true;
    return;
  }

  const label = day.in_progress
    ? "Today"
    : formatChartDate(dateToChartTimestamp(day.date ?? day.day));

  let html = `<span class="chart-daily-stat__label">Daily P&amp;L · ${label}</span>`;
  if (hasPnl) {
    html += ` · ${fmtSignedUSD(day.pnl_amount)}`;
    if (typeof day.pnl_percent === "number") {
      html += fmtSignedPct(day.pnl_percent);
    }
  }
  if (day.in_progress) {
    html += ` · <span class="chart-daily-stat__tag">In progress</span>`;
  }

  el.innerHTML = html;
  el.className =
    "chart-daily-stat " +
    (hasPnl ? (day.pnl_amount >= 0 ? "is-up" : "is-down") : "");
  el.hidden = false;
}

function updateGrowthChartSub(hasDaily, hasMonthlyLine) {
  const sub = $("[data-chart-sub]");
  if (!sub) return;
  if (hasDaily && hasMonthlyLine) {
    sub.textContent =
      "Growth % from starting balance · live daily balance · dashed = month-end before daily tracking";
  } else if (hasDaily) {
    sub.textContent = "Growth % from starting balance · live daily balance";
  } else {
    sub.textContent = "Growth % from starting balance · month-end markers until daily tracking begins";
  }
}

function monthEndTimestamp(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999).getTime();
}

/** Equity curve from confirmed monthly return % where configured. */
function buildEquityCurve(perf) {
  const months = monthRangeFromStart(perf.tracking_start);
  const initial = perf.initial_balance;
  const endEquity =
    typeof perf.equity === "number" ? perf.equity : initial + (perf.pnl_amount ?? 0);

  const hasReal = (mk) => typeof REAL_MONTHLY_RETURN_PCT?.[mk] === "number";
  const firstRealIdx = months.findIndex(hasReal);
  const allConfirmed = months.length > 0 && months.every(hasReal);

  if (firstRealIdx === -1) {
    const monthlyPnls = distributeMonthlyPnl(perf.pnl_amount, months);
    return finalizeEquityCurve(perf, months, monthlyPnls, months.map(() => "estimated"), months.map(() => null));
  }

  if (allConfirmed) {
    const monthlyPnls = [];
    const monthSources = [];
    const monthlyPcts = [];
    let running = initial;

    for (const mk of months) {
      const pct = REAL_MONTHLY_RETURN_PCT[mk];
      const pnl = Math.round(running * (pct / 100) * 100) / 100;
      monthlyPnls.push(pnl);
      monthSources.push("confirmed");
      monthlyPcts.push(pct);
      running = Math.round((running + pnl) * 100) / 100;
    }

    const drift = Math.round((endEquity - running) * 100) / 100;
    if (monthlyPnls.length && drift !== 0) {
      monthlyPnls[monthlyPnls.length - 1] = Math.round((monthlyPnls[monthlyPnls.length - 1] + drift) * 100) / 100;
    }

    return finalizeEquityCurve(perf, months, monthlyPnls, monthSources, monthlyPcts);
  }

  let balanceBeforeReal = initial;
  if (firstRealIdx > 0) {
    let bal = endEquity;
    for (let i = months.length - 1; i >= firstRealIdx; i--) {
      const pct = REAL_MONTHLY_RETURN_PCT[months[i]];
      bal = bal / (1 + pct / 100);
    }
    balanceBeforeReal = bal;
  }

  const preRealMonths = months.slice(0, firstRealIdx);
  const preRealPnls = firstRealIdx > 0
    ? distributeMonthlyPnl(balanceBeforeReal - initial, preRealMonths)
    : [];

  const monthlyPnls = [];
  const monthSources = [];
  const monthlyPcts = [];
  let running = initial;

  for (let i = 0; i < months.length; i++) {
    const mk = months[i];
    let pnl;
    let source;
    let pct = null;

    if (hasReal(mk)) {
      pct = REAL_MONTHLY_RETURN_PCT[mk];
      pnl = Math.round(running * (pct / 100) * 100) / 100;
      source = "confirmed";
    } else {
      pnl = preRealPnls[i] ?? 0;
      pct = running > 0 ? Math.round((pnl / running) * 10000) / 100 : null;
      source = "estimated";
    }

    monthlyPnls.push(pnl);
    monthSources.push(source);
    monthlyPcts.push(pct);
    running = Math.round((running + pnl) * 100) / 100;
  }

  const drift = Math.round((endEquity - running) * 100) / 100;
  if (monthlyPnls.length && drift !== 0) {
    monthlyPnls[monthlyPnls.length - 1] = Math.round((monthlyPnls[monthlyPnls.length - 1] + drift) * 100) / 100;
  }

  return finalizeEquityCurve(perf, months, monthlyPnls, monthSources, monthlyPcts);
}

function finalizeEquityCurve(perf, months, monthlyPnls, monthSources, monthlyPcts) {
  const startT = new Date(`${perf.tracking_start}T00:00:00`).getTime();
  const points = [{
    t: startT,
    e: perf.initial_balance,
    b: perf.initial_balance,
    month: months[0] ?? null,
    monthShort: months[0] ? formatMonthShort(months[0]) : "Start",
    isStart: true,
  }];
  let cumulative = 0;

  for (let i = 0; i < months.length; i++) {
    cumulative += monthlyPnls[i];
    const isLast = i === months.length - 1;
    const t = isLast ? Date.now() : monthEndTimestamp(months[i]);
    const eq = perf.initial_balance + cumulative;
    points.push({
      t,
      e: eq,
      b: eq,
      month: months[i],
      monthShort: formatMonthShort(months[i]),
      isCurrent: isLast,
    });
  }

  if (typeof perf.equity === "number" && points.length > 1) {
    const last = points[points.length - 1];
    last.b = typeof perf.balance === "number" ? perf.balance : perf.equity;
    last.e = perf.equity;
    last.isCurrent = true;
  }

  return { points, monthlyPnls, months, monthSources, monthlyPcts };
}

let lastPerformance = null;
let lastEstimatedMonthly = null;

function revealDynamic(el) {
  if (!el) return;
  el.hidden = false;
  el.style.opacity = "1";
  el.style.visibility = "visible";
  el.style.transform = "none";
  if (typeof gsap !== "undefined") {
    gsap.killTweensOf(el);
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === el) st.kill();
      });
    }
    gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0, clearProps: "transform" });
    if (!el.dataset.trackRevealed) {
      gsap.from(el, { y: 18, opacity: 0, duration: 0.55, ease: "power2.out" });
      el.dataset.trackRevealed = "1";
    }
  }
  el.classList.add("is-revealed");
  if (window.AuremScroll?.revealElement) window.AuremScroll.revealElement(el);
  else if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
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
    const change = asApiNumber(data.change) ?? 0;
    const pctTxt = fmtApiChangePct(data.change_pct);
    changeEl.textContent = `${fmtApiChangeUsd(data.change)}${pctTxt} today`;
    changeEl.className = "ticker__change " + (change > 0 ? "is-up" : change < 0 ? "is-down" : "");
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
    if (dirEl) dirEl.textContent = "…";
    if (strEl) strEl.textContent = "…";
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
  if (meta) meta.textContent = `Based on ${data.based_on_items ?? "…"} recent items`;
  if (dirEl) dirEl.textContent = score.toFixed(1);
  if (strEl) strEl.textContent =
    typeof data.strength_abs === "number" ? `${data.strength_abs.toFixed(1)}/100` : "…";
  if (updatedEl && data.updated_at) updatedEl.textContent = `Updated ${timeAgo(data.updated_at)}.`;
}

/* ------------------------------- performance ------------------------------- */
async function refreshPerformance() {
  const data = await api.performance();
  lastPerformance = data;
  const equityEl = $("[data-equity]");
  const balanceEl = $("[data-balance]");
  const updatedEl = $("[data-perf-updated]");
  const statusEl = $("[data-perf-status]");
  const staleEl = $("[data-stale]");
  const pnlCard = $("[data-pnl-card]");
  const pnlValue = $("[data-pnl-value]");
  const pnlLabel = $("[data-pnl-label]");
  const pnlSub = $("[data-pnl-sublabel]");
  const ctxEl = $("[data-tracking-context]");

  if (!data || !data.available) {
    [equityEl, balanceEl].forEach((el) => el && (el.textContent = "unavailable"));
    if (updatedEl) updatedEl.textContent = "…";
    if (statusEl) { statusEl.textContent = "Account feed unavailable"; statusEl.className = "stat-card__status"; }
    if (staleEl) staleEl.hidden = true;
    if (pnlCard) pnlCard.hidden = true;
    if (ctxEl) ctxEl.hidden = true;
    return;
  }

  if (equityEl) equityEl.textContent = `$${fmtUSD(data.equity)}`;
  if (balanceEl) balanceEl.textContent = `$${fmtUSD(data.balance)}`;
  if (updatedEl) updatedEl.textContent = data.ea_reported_at || timeAgo(data.checked_at);

  if (staleEl) staleEl.hidden = !data.stale;
  if (statusEl) {
    statusEl.textContent = data.stale ? "Stale, awaiting refresh" : "Live";
    statusEl.className = "stat-card__status " + (data.stale ? "is-stale" : "is-live");
  }

  if (ctxEl) {
    if (data.tracking_start && typeof data.initial_balance === "number") {
      const since = formatTrackingStart(data.tracking_start);
      ctxEl.textContent = `Tracking since ${since} · $${fmtUSD(data.initial_balance)} starting balance`;
      revealDynamic(ctxEl);
    } else {
      ctxEl.hidden = true;
    }
  }

  if (pnlCard && pnlValue && pnlLabel && pnlSub) {
    if (hasSinceInceptionPnl(data)) {
      const since = formatTrackingStart(data.tracking_start);
      const signPct = data.pnl_percent >= 0 ? "+" : "−";
      pnlLabel.textContent = `Total P&L since ${since}`;
      pnlValue.textContent = fmtSignedUSD(data.pnl_amount);
      pnlValue.className = "stat-card__v stat-card__v--pnl " + (data.pnl_amount >= 0 ? "is-up" : "is-down");
      pnlSub.textContent = `${signPct}${Math.abs(data.pnl_percent).toFixed(1)}% since ${since}`;
      revealDynamic(pnlCard);
    } else {
      pnlCard.hidden = true;
    }
  }

  updateHistoricalDrawdownBadge(data);
}

/* ------------------------------- history chart ------------------------------- */
function renderGrowthChart(svg, empty, { monthlyPoints = [], dailyPoints = [], initial } = {}) {
  const monthLegend = $("[data-chart-legend-monthly]");
  const hasMonthlyLine = monthlyPoints.length >= 2;
  const hasDaily = dailyPoints.length > 0;

  updateGrowthChartSub(hasDaily, hasMonthlyLine);

  if (monthLegend) {
    monthLegend.hidden = !hasMonthlyLine;
    monthLegend.style.display = hasMonthlyLine ? "" : "none";
  }

  if ((!hasMonthlyLine && !hasDaily) || !initial) {
    if (empty) { empty.hidden = false; empty.textContent = "History unavailable"; }
    svg.innerHTML = "";
    return;
  }

  const scalePoints = [...monthlyPoints, ...dailyPoints];
  const W = 800;
  const H = 320;
  const padL = 62;
  const padR = 20;
  const padT = 24;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const plotBottom = padT + plotH;

  const growthVals = scalePoints.map((d) => toGrowthPct(d.b, initial));
  let min = Math.min(...growthVals, 0);
  let max = Math.max(...growthVals, 5);
  const span = max - min || 1;
  min -= span * 0.05;
  max += span * 0.08;

  const t0 = scalePoints[0].t;
  const t1 = scalePoints[scalePoints.length - 1].t;
  const tSpan = t1 - t0 || 1;
  const x = (t) => padL + ((t - t0) / tSpan) * plotW;
  const yG = (v) => padT + (1 - (toGrowthPct(v, initial) - min) / (max - min)) * plotH;
  const yPct = (pct) => padT + (1 - (pct - min) / (max - min)) * plotH;
  const yBal = (pt) => yG(pt.b);

  const yTicks = chartYTicks(min, max, 6);
  const xLabels = buildCombinedChartLabels(monthlyPoints, dailyPoints);

  const gridH = yTicks
    .map(
      (pct) =>
        `<line class="chart__grid" x1="${padL}" y1="${yPct(pct).toFixed(1)}" x2="${W - padR}" y2="${yPct(pct).toFixed(1)}" />`
    )
    .join("");

  const gridV = xLabels
    .map(
      ({ t }) =>
        `<line class="chart__grid chart__grid--v" x1="${x(t).toFixed(1)}" y1="${padT}" x2="${x(t).toFixed(1)}" y2="${plotBottom}" />`
    )
    .join("");

  const yAxis = yTicks
    .map(
      (pct) =>
        `<text class="chart__axis-label chart__axis-label--y" x="${padL - 8}" y="${yPct(pct).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${formatGrowthAxisY(pct)}</text>`
    )
    .join("");

  const xAxis = chartXAxisLabels(xLabels, x, plotBottom, padL);

  const zeroY = yPct(Math.max(0, min)).toFixed(1);
  const zeroLine =
    min < 0 && max > 0
      ? `<line class="chart__zero" x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" />`
      : "";

  let linePaths = "";
  if (hasMonthlyLine) {
    const monthlyPath = straightLinePath(monthlyPoints, x, yBal);
    linePaths += `<path class="chart__line chart__line--monthly" d="${monthlyPath}" stroke="#e8874f" stroke-width="2" stroke-dasharray="7 5" fill="none" />`;
  }
  if (hasMonthlyLine && hasDaily) {
    const bridge = straightLinePath(
      [monthlyPoints[monthlyPoints.length - 1], dailyPoints[0]],
      x,
      yBal
    );
    linePaths += `<path class="chart__line chart__line--bridge" d="${bridge}" stroke="#e8874f" stroke-width="2" stroke-dasharray="4 4" fill="none" />`;
  }
  if (hasDaily) {
    const dailyPath = smoothLinePath(dailyPoints, "b", x, (pt, key) => yG(pt[key]));
    linePaths += `<path class="chart__line chart__line--growth" d="${dailyPath}" stroke="#e8874f" stroke-width="2.25" fill="none" />`;
  }

  const dailyDots = hasDaily
    ? dailyPoints
        .map((p) => {
          const xi = x(p.t).toFixed(1);
          const yi = yBal(p).toFixed(1);
          return `<circle class="chart__dot chart__dot--growth" cx="${xi}" cy="${yi}" r="4.5" />`;
        })
        .join("")
    : "";

  if (empty) empty.hidden = true;
  svg.innerHTML = `
    <rect class="chart__plot-bg" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" rx="4" />
    ${gridV}
    ${gridH}
    ${zeroLine}
    <line class="chart__axis" x1="${padL}" y1="${plotBottom}" x2="${W - padR}" y2="${plotBottom}" />
    <line class="chart__axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${plotBottom}" />
    ${yAxis}
    ${xAxis}
    ${linePaths}
    ${dailyDots}
  `;

  svg.querySelectorAll(".chart__line").forEach((path) => {
    path.style.strokeDasharray = path.getAttribute("stroke-dasharray") || "none";
    path.style.strokeDashoffset = "0";
    path.style.opacity = "1";
  });

  if (window.AuremScroll?.bindChartDraw) {
    svg.dataset.cinemaBound = "";
    window.AuremScroll.bindChartDraw(svg);
  }
}

function formatDrawdownAxisY(pct) {
  if (pct === 0) return "0%";
  return `−${Math.abs(pct).toFixed(0)}%`;
}

function renderDrawdownChart(svg, empty, dailyPoints) {
  if (!svg) return;

  if (!dailyPoints?.length) {
    svg.innerHTML = "";
    if (empty) {
      empty.hidden = false;
      empty.textContent = "No daily drawdown recorded yet.";
    }
    return;
  }

  const peakDd = Math.max(...dailyPoints.map((p) => p.ddPct), 0);
  const maxDd = Math.max(MAX_CHART_DRAWDOWN_PCT, Math.ceil(peakDd / 2) * 2);
  const W = 800;
  const H = 220;
  const padL = 62;
  const padR = 20;
  const padT = 16;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const plotBottom = padT + plotH;

  const t0 = dailyPoints[0].t;
  const t1 = dailyPoints[dailyPoints.length - 1].t;
  const tSpan = t1 - t0 || 1;
  const x = (t) => padL + ((t - t0) / tSpan) * plotW;
  const yDd = (pct) => padT + (pct / maxDd) * plotH;
  const barW = Math.max(2, Math.min(5, plotW / dailyPoints.length * 0.85));

  const yTicks = [0, -2, -4, -6, -8, -10].filter((v) => Math.abs(v) <= maxDd);
  const xLabels = buildCombinedChartLabels([], dailyPoints);

  const bars = dailyPoints
    .filter((p) => p.ddPct > 0.01)
    .map((p) => {
      const xi = x(p.t);
      const yTop = yDd(0);
      const yBot = yDd(p.ddPct);
      const h = Math.max(1, yBot - yTop);
      return `<rect class="chart__dd-bar chart__dd-bar--daily" x="${(xi - barW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="0.5" />`;
    })
    .join("");

  const gridH = yTicks
    .map(
      (pct) =>
        `<line class="chart__grid" x1="${padL}" y1="${yDd(Math.abs(pct)).toFixed(1)}" x2="${W - padR}" y2="${yDd(Math.abs(pct)).toFixed(1)}" />`
    )
    .join("");

  const gridV = xLabels
    .map(
      ({ t }) =>
        `<line class="chart__grid chart__grid--v" x1="${x(t).toFixed(1)}" y1="${padT}" x2="${x(t).toFixed(1)}" y2="${plotBottom}" />`
    )
    .join("");

  const yAxis = yTicks
    .map(
      (pct) =>
        `<text class="chart__axis-label chart__axis-label--y" x="${padL - 8}" y="${yDd(Math.abs(pct)).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${formatDrawdownAxisY(pct)}</text>`
    )
    .join("");

  const xAxis = chartXAxisLabels(xLabels, x, plotBottom, padL);

  if (empty) empty.hidden = true;
  svg.innerHTML = `
    <rect class="chart__plot-bg" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" rx="4" />
    ${gridV}
    ${gridH}
    <line class="chart__zero chart__zero--dd" x1="${padL}" y1="${yDd(0).toFixed(1)}" x2="${W - padR}" y2="${yDd(0).toFixed(1)}" />
    <line class="chart__axis" x1="${padL}" y1="${plotBottom}" x2="${W - padR}" y2="${plotBottom}" />
    <line class="chart__axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${plotBottom}" />
    ${yAxis}
    ${xAxis}
    ${bars}
  `;

  if (window.AuremScroll?.bindChartDraw) {
    svg.dataset.cinemaBound = "";
    window.AuremScroll.bindChartDraw(svg);
  }
}

async function refreshHistory() {
  let perf = lastPerformance;
  if (!perf?.tracking_start || typeof perf?.initial_balance !== "number") {
    perf = (await api.performance()) ?? perf;
    if (perf) lastPerformance = perf;
  }

  updateHistoricalDrawdownBadge(perf);

  const svg = $("[data-chart] .chart__svg");
  const empty = $("[data-chart-empty]");
  const ddSvg = $(".chart__svg--dd");
  const ddEmpty = $("[data-chart-dd-empty]");
  if (!svg) return;

  if (!perf?.initial_balance) {
    if (empty) { empty.hidden = false; empty.textContent = "History unavailable"; }
    svg.innerHTML = "";
    if (ddSvg) ddSvg.innerHTML = "";
    if (ddEmpty) { ddEmpty.hidden = false; ddEmpty.textContent = "No daily drawdown recorded yet."; }
    return;
  }

  const [monthlyData, dailyData] = await Promise.all([api.monthly(), api.daily()]);
  const dailyPoints = parseDailyChartPoints(dailyData, perf.initial_balance);
  const firstDailyDayStart = dailyPoints[0]?.date
    ? new Date(`${dailyPoints[0].date}T00:00:00`).getTime()
    : null;
  const monthlyPoints = buildMonthlyChartPoints(monthlyData, perf, firstDailyDayStart);

  renderGrowthChart(svg, empty, {
    monthlyPoints,
    dailyPoints,
    initial: perf.initial_balance,
  });
  renderDrawdownChart(ddSvg, ddEmpty, dailyPoints);
  updateChartDailyStat(dailyData);
}

/* ------------------------------- monthly P&L ------------------------------- */
async function refreshMonthly() {
  const data = await api.monthly();
  const wrap = $("[data-monthly-wrap]");
  const body = $("[data-monthly-body]");
  const empty = $("[data-monthly-empty]");
  const note = $("[data-monthly-note]");
  if (!wrap || !body) return;

  if (!data || !Array.isArray(data.months) || data.months.length === 0) {
    wrap.hidden = true;
    if (empty) empty.hidden = true;
    return;
  }

  revealDynamic(wrap);
  if (empty) empty.hidden = true;

  if (note && data.tracking_start && typeof data.initial_balance === "number") {
    const since = formatTrackingStart(data.tracking_start);
    const perf = lastPerformance;
    if (hasSinceInceptionPnl(perf)) {
      note.textContent = `Since ${since} · $${fmtUSD(data.initial_balance)} starting balance. Monthly returns below are confirmed on balance at each month start.`;
    } else {
      note.textContent = `Since ${since} · $${fmtUSD(data.initial_balance)} starting balance. Missing months stay marked as pending, never estimated.`;
    }
  }

  const perf = lastPerformance;
  const curve =
    lastEstimatedMonthly ??
    (hasSinceInceptionPnl(perf) ? buildEquityCurve(perf) : null);

  body.innerHTML = data.months
    .map((row, idx) => {
      const month = formatMonthLabel(row.month);
      let pnlClass = "monthly-pnl is-pending";
      let pnlText = "Data pending";
      let statusHtml = '<span class="monthly-tag monthly-tag--pending">Data pending</span>';

      const monthPnl =
        curve?.monthlyPnls && curve.months[idx] === row.month ? curve.monthlyPnls[idx] : null;
      const monthSource =
        curve?.monthSources && curve.months[idx] === row.month ? curve.monthSources[idx] : null;
      const monthPct =
        curve?.monthlyPcts && curve.months[idx] === row.month ? curve.monthlyPcts[idx] : null;

      if (row.available && typeof row.pnl_amount === "number") {
        pnlClass = `monthly-pnl ${row.pnl_amount >= 0 ? "is-up" : "is-down"}`;
        pnlText = fmtSignedUSD(row.pnl_amount);
        if (row.in_progress) {
          statusHtml = '<span class="monthly-tag monthly-tag--progress">In progress</span>';
        } else {
          statusHtml = '<span class="monthly-tag monthly-tag--confirmed">Confirmed</span>';
        }
      } else if (monthSource === "confirmed" && typeof monthPnl === "number") {
        pnlClass = `monthly-pnl ${monthPnl >= 0 ? "is-up" : "is-down"}`;
        pnlText = fmtSignedUSD(monthPnl);
        const pctLabel = typeof monthPct === "number" ? ` · +${monthPct.toFixed(2)}%` : "";
        if (row.in_progress) {
          statusHtml = `<span class="monthly-tag monthly-tag--progress">In progress${pctLabel}</span>`;
        } else {
          statusHtml = `<span class="monthly-tag monthly-tag--confirmed">Confirmed${pctLabel}</span>`;
        }
      } else if (row.in_progress && typeof monthPnl === "number") {
        statusHtml = '<span class="monthly-tag monthly-tag--progress">In progress</span>';
        pnlClass = `monthly-pnl ${monthPnl >= 0 ? "is-up" : "is-down"}`;
        pnlText = fmtSignedUSD(monthPnl);
      } else if (monthSource === "estimated" && typeof monthPnl === "number") {
        pnlClass = `monthly-pnl ${monthPnl >= 0 ? "is-up" : "is-down"}`;
        pnlText = fmtSignedUSD(monthPnl);
        statusHtml = '<span class="monthly-tag monthly-tag--estimated">Estimated</span>';
      }

      return `
        <tr>
          <td>${escapeHtml(month)}</td>
          <td><span class="${pnlClass}">${escapeHtml(pnlText)}</span></td>
          <td>${statusHtml}</td>
        </tr>`;
    })
    .join("");
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
  const rail = $(".news__rail");
  if (!scroller) return;

  const syncScroller = () => {
    const overflow = scroller.scrollHeight > scroller.clientHeight + 2;
    scroller.classList.toggle("news__scroller--overflow", overflow);
    if (rail) rail.style.height = `${scroller.clientHeight}px`;
    if (fill) {
      const max = scroller.scrollHeight - scroller.clientHeight;
      fill.style.height = max > 0 ? `${(scroller.scrollTop / max) * 100}%` : "0%";
    }
  };

  if (scroller._newsRailHandler) {
    scroller.removeEventListener("scroll", scroller._newsRailHandler);
  }
  scroller._newsRailHandler = syncScroller;
  scroller.addEventListener("scroll", syncScroller, { passive: true });
  syncScroller();
}

async function refreshNews() {
  const data = await api.news();
  const list = $("[data-news]");
  if (!list) return;

  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    list.innerHTML = `<p class="news__empty">News feed unavailable right now. Check back shortly.</p>`;
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
  $$("[data-vt-markets]").forEach((el) => (el.href = VT_MARKETS_PARTNER_URL));

  // Checkout CTAs handled by motion.js (macro confirm → Telegram).
}

document.addEventListener("DOMContentLoaded", () => {
  clearLegacyPriceStorage();
  wireBullFallback();
  wireStaticLinks();
  poll(refreshPrice, POLL.price);
  poll(refreshBias, POLL.bias);
  poll(refreshPerformance, POLL.performance);
  poll(refreshHistory, POLL.daily);
  poll(refreshMonthly, POLL.monthly);
  poll(refreshNews, POLL.news);

  refreshPerformance().then(() => {
    refreshHistory();
    refreshMonthly();
  });
});
