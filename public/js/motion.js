/*
 * AuremAI — scroll reveals, staging control, hover helpers, macro confirm.
 * Scroll choreography is handled by scroll-cinema.js (GSAP).
 */

const STAGE = {
  confirmWindowMs: 3200,
  navSections: ["hero", "signal", "track", "news", "how", "pricing", "faq"],
};

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------- nav scroll spy ------------------------- */
function initScrollSpy() {
  const links = $$(".nav__links a");
  const map = new Map(
    links.map((a) => {
      const id = (a.getAttribute("href") || "").replace("#", "");
      return [id, a];
    })
  );

  const sections = STAGE.navSections
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const onScroll = () => {
    const y = window.scrollY + 120;
    let current = sections[0]?.id;
    for (const sec of sections) {
      if (sec.offsetTop <= y) current = sec.id;
    }
    links.forEach((a) => a.classList.remove("is-active"));
    map.get(current)?.classList.add("is-active");
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ------------------------- scroll progress ------------------------- */
function initScrollProgress() {
  const wrap = document.createElement("div");
  wrap.className = "scroll-progress";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = '<div class="scroll-progress__fill"></div>';
  document.body.prepend(wrap);
  const fill = wrap.querySelector(".scroll-progress__fill");

  const setProgress = (pct) => {
    fill.style.height = `${pct * 100}%`;
  };

  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined" && !prefersReducedMotion()) {
    ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: 0.15,
      onUpdate: (self) => setProgress(self.progress),
    });
    return;
  }

  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(max > 0 ? window.scrollY / max : 0);
  };
  window.addEventListener("scroll", tick, { passive: true });
  tick();
}

/* ------------------------- card hover glow pointer ------------------------- */
function initHoverGlow() {
  $$(".hover-glow").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* ------------------------- macro action + confirm ------------------------- */
function initMacroConfirm() {
  const toast = document.createElement("div");
  toast.className = "macro-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  let toastTimer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  const pending = new WeakMap();

  $$("[data-macro-action]").forEach((btn) => {
    const defaultLabel = btn.textContent.trim();
    const confirmLabel = btn.dataset.confirmLabel || "Tap again to confirm";

    btn.addEventListener("click", (e) => {
      if (btn.dataset.checkout !== undefined) {
        e.preventDefault();
      }

      const state = pending.get(btn);
      if (state && Date.now() - state.at < STAGE.confirmWindowMs) {
        pending.delete(btn);
        btn.classList.remove("is-confirming");
        btn.textContent = defaultLabel;
        showToast("Confirmed — opening…");

        const url = btn.getAttribute("href");
        if (url?.startsWith("https://buy.stripe.com")) {
          setTimeout(() => window.open(url, "_blank", "noopener"), 280);
        } else if (btn.dataset.checkout !== undefined) {
          setTimeout(() => window.open(TELEGRAM_URL, "_blank", "noopener"), 280);
        } else if (btn.hasAttribute("data-telegram")) {
          e.preventDefault();
          setTimeout(() => window.open(TELEGRAM_URL, "_blank", "noopener"), 280);
        } else {
          const href = btn.getAttribute("href");
          if (href?.startsWith("#")) {
            setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }), 200);
          }
        }
        return;
      }

      e.preventDefault();
      pending.set(btn, { at: Date.now() });
      btn.classList.add("is-confirming");
      btn.textContent = confirmLabel;
      showToast(confirmLabel);

      setTimeout(() => {
        if (!pending.has(btn)) return;
        pending.delete(btn);
        btn.classList.remove("is-confirming");
        btn.textContent = defaultLabel;
      }, STAGE.confirmWindowMs);
    });
  });
}

/* ------------------------- re-stagger dynamically injected news ------------------------- */
function observeNewsReveal() {
  const list = $("[data-news]");
  if (!list) return;

  const mo = new MutationObserver(() => {
    const items = $$(".news-item", list);
    if (items.length && window.AuremScroll?.registerNewsItems) {
      window.AuremScroll.registerNewsItems(items);
    }
  });
  mo.observe(list, { childList: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollSpy();
  initScrollProgress();
  initHoverGlow();
  initMacroConfirm();
  observeNewsReveal();
});
