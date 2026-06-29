/*
 * AuremAI — FAQ rotating card deck (scroll + arrows)
 */
(function () {
  const deck = document.querySelector("[data-faq-deck]");
  const viewport = document.querySelector("[data-faq-viewport]");
  const stage = document.querySelector("[data-faq-stage]");
  if (!deck || !viewport || !stage) return;

  const panels = Array.from(stage.querySelectorAll("[data-faq-panel]"));
  const counterEl = document.querySelector("[data-faq-counter]");
  const prevBtn = document.querySelector("[data-faq-prev]");
  const nextBtn = document.querySelector("[data-faq-next]");
  if (!panels.length) return;

  const total = panels.length;
  let index = 0;
  let wheelLock = false;
  let touchY = null;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function stackOffset(i) {
    return (i - index + total) % total;
  }

  function layoutDeck(animate) {
    panels.forEach((panel, i) => {
      const offset = stackOffset(i);
      const isFront = offset === 0;
      panel.classList.toggle("is-active", isFront);
      panel.setAttribute("aria-hidden", isFront ? "false" : "true");
      panel.setAttribute("tabindex", isFront ? "0" : "-1");

      let y = 56;
      let scale = 0.82;
      let rotate = 0;
      let opacity = 0;
      let zIndex = 0;

      if (offset === 0) {
        y = 0;
        scale = 1;
        rotate = 0;
        opacity = 1;
        zIndex = 40;
      } else if (offset === 1) {
        y = 22;
        scale = 0.94;
        rotate = -2.8;
        opacity = 0.45;
        zIndex = 39;
      } else if (offset === 2) {
        y = 40;
        scale = 0.88;
        rotate = 2.4;
        opacity = 0.22;
        zIndex = 38;
      }

      const props = {
        xPercent: -50,
        yPercent: -50,
        left: "50%",
        top: "50%",
        y,
        scale,
        rotation: rotate,
        opacity,
        zIndex,
        duration: animate && !prefersReduced ? 0.62 : 0,
        ease: "power3.inOut",
        overwrite: true,
      };

      if (typeof gsap !== "undefined") {
        gsap.to(panel, props);
        if (isFront) {
          const rule = panel.querySelector(".faq__rule");
          if (rule) {
            if (animate && !prefersReduced) {
              gsap.fromTo(
                rule,
                { scaleX: 0, opacity: 0 },
                { scaleX: 1, opacity: 1, duration: 0.65, ease: "power3.out", transformOrigin: "left center" }
              );
            } else {
              gsap.set(rule, { scaleX: 1, opacity: 1, transformOrigin: "left center" });
            }
          }
        }
      } else {
        panel.style.zIndex = String(zIndex);
        panel.style.opacity = String(opacity);
        panel.style.transform = `translate(-50%, calc(-50% + ${y}px)) scale(${scale}) rotate(${rotate}deg)`;
      }
    });

    if (counterEl) {
      counterEl.textContent = `${pad(index + 1)} / ${pad(total)}`;
    }
  }

  function go(delta) {
    index = (index + delta + total) % total;
    layoutDeck(true);
  }

  function onWheel(e) {
    if (wheelLock || Math.abs(e.deltaY) < 18) return;
    e.preventDefault();
    wheelLock = true;
    go(e.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLock = false;
    }, prefersReduced ? 120 : 680);
  }

  viewport.addEventListener("wheel", onWheel, { passive: false });

  viewport.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.changedTouches[0]?.clientY ?? null;
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchend",
    (e) => {
      if (touchY == null) return;
      const endY = e.changedTouches[0]?.clientY;
      if (endY == null) return;
      const dy = touchY - endY;
      touchY = null;
      if (Math.abs(dy) < 36) return;
      go(dy > 0 ? 1 : -1);
    },
    { passive: true }
  );

  prevBtn?.addEventListener("click", () => go(-1));
  nextBtn?.addEventListener("click", () => go(1));

  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  });

  panels.forEach((panel, i) => {
    if (typeof gsap !== "undefined") {
      gsap.set(panel, { xPercent: -50, yPercent: -50, left: "50%", top: "50%", position: "absolute" });
    }
    panel.addEventListener("click", () => {
      if (stackOffset(i) === 1) go(1);
      else if (stackOffset(i) === 2) go(2);
    });
  });

  layoutDeck(false);

  window.AuremFaqDeck = { go, layoutDeck, getIndex: () => index };
})();
