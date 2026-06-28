/*
 * AuremAI — scroll cinema: GSAP ScrollTrigger choreography per section.
 * Each scene gets a distinct entrance language; section breaks animate separately.
 */

(function initScrollCinema() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);

  if (reduced) {
    gsap.set("[data-reveal], [data-scene-break], .hero__word, .news-item, .faq__item", {
      clearProps: "all",
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      rotateX: 0,
      rotateY: 0,
      filter: "none",
    });
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const EASE = "power3.out";
  const EASE_EXPO = "expo.out";

  /* ===================== HERO — load sequence + exit parallax ===================== */
  function initHero() {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const tl = gsap.timeline({ defaults: { ease: EASE_EXPO } });

    tl.from(".nav", { y: -24, opacity: 0, duration: 0.9 })
      .from(
        ".hero .eyebrow",
        { y: 20, opacity: 0, duration: 0.7 },
        "-=0.5"
      )
      .from(
        ".hero__word",
        {
          yPercent: 110,
          opacity: 0,
          duration: 0.85,
          stagger: { each: 0.06, from: "start" },
        },
        "-=0.35"
      )
      .from(
        ".hero__sub",
        { y: 28, opacity: 0, filter: "blur(8px)", duration: 0.8 },
        "-=0.45"
      )
      .from(
        "#heroTicker",
        { scale: 0.88, opacity: 0, duration: 0.75, ease: "back.out(1.4)" },
        "-=0.5"
      )
      .from(
        ".hero__cta .btn",
        { y: 20, opacity: 0, duration: 0.6, stagger: 0.12 },
        "-=0.4"
      );

    gsap.to(".hero__copy", {
      y: -80,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 1.2,
      },
    });

    gsap.to(".hero__glow", {
      scale: 1.4,
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        if (window.__auremScene?.setScroll) {
          window.__auremScene.setScroll(self.progress);
        }
      },
    });
  }

  /* ===================== SECTION BREAKS ===================== */
  function initBreaks() {
    gsap.utils.toArray("[data-scene-break]").forEach((brk, i) => {
      const beam = brk.querySelector(".scene-break__beam");
      const wedge = brk.querySelector(".scene-break__wedge");
      const dots = brk.querySelectorAll(".scene-break__dots span");
      const dash = brk.querySelector(".scene-break__dash");
      const hairline = brk.querySelector(".scene-break__hairline");
      const rules = brk.querySelectorAll(".scene-break__rule");
      const idx = brk.querySelector(".scene-break__idx");
      const title = brk.querySelector(".scene-break__title");

      gsap.set(brk, { opacity: 0, y: i % 2 ? 16 : -16 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: brk,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });

      tl.to(brk, { opacity: 1, y: 0, duration: 0.7, ease: EASE });

      if (beam) {
        gsap.set(beam, { scaleX: 0, transformOrigin: "left center" });
        tl.to(beam, { scaleX: 1, duration: 1.1, ease: "power2.inOut" }, "-=0.4");
      }
      if (wedge) {
        gsap.set(wedge, { scaleY: 0, transformOrigin: "top center" });
        tl.to(wedge, { scaleY: 1, duration: 0.9, ease: EASE }, "-=0.6");
      }
      if (dots.length) {
        gsap.set(dots, { scale: 0, opacity: 0 });
        tl.to(dots, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.08, ease: "back.out(2)" }, "-=0.5");
      }
      if (dash) {
        gsap.set(dash, { scaleX: 0, transformOrigin: "left center" });
        tl.to(dash, { scaleX: 1, duration: 1, ease: "power2.inOut" }, "-=0.5");
      }
      if (hairline) {
        gsap.set(hairline, { scaleX: 0 });
        tl.to(hairline, { scaleX: 1, duration: 0.8, ease: EASE }, "-=0.4");
      }
      if (rules.length) {
        gsap.set(rules, { scaleX: 0, transformOrigin: "center" });
        tl.to(rules, { scaleX: 1, duration: 0.7, stagger: 0.1, ease: EASE }, "-=0.5");
      }
      if (idx) tl.from(idx, { opacity: 0, letterSpacing: "0.5em", duration: 0.6 }, "-=0.7");
      if (title) tl.from(title, { opacity: 0, y: 10, duration: 0.5 }, "-=0.5");
    });
  }

  /* ===================== SIGNAL — pin + gauge + pipeline ===================== */
  function initSignal() {
    const sec = document.getElementById("signal");
    if (!sec) return;

    const pipeline = document.querySelector("[data-pipeline]");
    if (pipeline) {
      gsap.from(pipeline.querySelectorAll(".signal__pipe-node"), {
        y: 12,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: EASE,
        scrollTrigger: { trigger: pipeline, start: "top 90%" },
      });
      gsap.from(pipeline.querySelectorAll(".signal__pipe-arrow"), {
        opacity: 0,
        scale: 0,
        duration: 0.35,
        stagger: 0.1,
        ease: "back.out(3)",
        scrollTrigger: { trigger: pipeline, start: "top 88%" },
      });
    }

    ScrollTrigger.create({
      trigger: sec,
      start: "top top",
      end: "+=40%",
      pin: false,
    });
  }

  /* ===================== TRACK — stat flip + chart draw ===================== */
  function initTrack() {
    const sec = document.getElementById("track");
    if (!sec) return;

    gsap.from("#track .section__head > *", {
      y: 36,
      opacity: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: EASE,
      scrollTrigger: { trigger: sec, start: "top 75%" },
    });

    gsap.utils.toArray(".stat-card").forEach((card, i) => {
      gsap.from(card, {
        rotateX: -18,
        y: 40,
        opacity: 0,
        transformPerspective: 800,
        duration: 0.85,
        delay: i * 0.08,
        ease: EASE,
        scrollTrigger: { trigger: card, start: "top 85%" },
      });
    });

    gsap.from(".chart-card", {
      y: 50,
      opacity: 0,
      scale: 0.96,
      duration: 1,
      ease: EASE,
      scrollTrigger: { trigger: ".chart-card", start: "top 82%" },
    });
  }

  function bindChartDraw(svg) {
    if (!svg || svg.dataset.cinemaBound) return;
    svg.dataset.cinemaBound = "1";
    const paths = svg.querySelectorAll("path[stroke]");
    paths.forEach((path) => {
      const len = path.getTotalLength?.() || 800;
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1.6,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: ".chart-card",
          start: "top 70%",
          toggleActions: "play none none none",
        },
      });
    });
    const fill = svg.querySelector("path[fill^='url']");
    if (fill) {
      gsap.from(fill, {
        opacity: 0,
        duration: 1.2,
        scrollTrigger: { trigger: ".chart-card", start: "top 68%" },
      });
    }
  }

  /* ===================== NEWS — 3D card cascade ===================== */
  function registerNewsItems(items) {
    if (!items?.length) return;
    const fresh = items.filter((el) => !el.dataset.cinemaBound);
    if (!fresh.length) return;
    fresh.forEach((el) => { el.dataset.cinemaBound = "1"; });
    gsap.set(fresh, { opacity: 0, y: 20 });
    ScrollTrigger.batch(fresh, {
      start: "top 92%",
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.06,
          ease: EASE,
          overwrite: true,
        });
      },
      once: true,
    });
  }

  function initNews() {
    gsap.from("#news .section__head > *", {
      y: 30,
      opacity: 0,
      stagger: 0.1,
      duration: 0.75,
      ease: EASE,
      scrollTrigger: { trigger: "#news", start: "top 75%" },
    });
    gsap.from("#news .news__feed", {
      y: 36,
      opacity: 0,
      duration: 0.85,
      ease: EASE,
      scrollTrigger: { trigger: "#news .news__feed", start: "top 82%" },
    });
    registerNewsItems(gsap.utils.toArray(".news-item"));
  }

  /* ===================== HOW — pinned timeline draw ===================== */
  function initHow() {
    const sec = document.getElementById("how");
    if (!sec) return;

    gsap.from("#how .section__head > *", {
      y: 28,
      opacity: 0,
      stagger: 0.1,
      duration: 0.75,
      ease: EASE,
      scrollTrigger: { trigger: sec, start: "top 75%" },
    });

    const steps = gsap.utils.toArray(".step");

    steps.forEach((step, i) => {
      gsap.from(step, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: EASE,
        scrollTrigger: {
          trigger: ".steps",
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
        delay: i * 0.08,
      });
    });
  }

  /* ===================== PRICING — perspective fan ===================== */
  function initPricing() {
    const sec = document.getElementById("pricing");
    if (!sec) return;

    gsap.from("#pricing .section__head > *", {
      y: 32,
      opacity: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: EASE,
      scrollTrigger: { trigger: sec, start: "top 75%" },
    });

    const plans = gsap.utils.toArray(".plan");
    gsap.set(plans, { rotateY: 22, opacity: 0, z: -80, transformPerspective: 1000 });
    gsap.to(plans, {
      rotateY: 0,
      opacity: 1,
      z: 0,
      duration: 0.95,
      stagger: 0.14,
      ease: EASE,
      scrollTrigger: { trigger: ".plans", start: "top 78%" },
    });

    gsap.from(".plan--featured", {
      scale: 0.94,
      boxShadow: "0 0 0 rgba(0,0,0,0)",
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: { trigger: ".plan--featured", start: "top 80%" },
    });
  }

  /* ===================== FAQ — blur rise ===================== */
  function initFaq() {
    gsap.from("#faq .section__head > *", {
      y: 24,
      opacity: 0,
      stagger: 0.08,
      duration: 0.7,
      ease: EASE,
      scrollTrigger: { trigger: "#faq", start: "top 78%" },
    });

    gsap.utils.toArray(".faq__item").forEach((item, i) => {
      gsap.from(item, {
        y: 32,
        opacity: 0,
        filter: "blur(10px)",
        duration: 0.65,
        ease: EASE,
        scrollTrigger: { trigger: item, start: "top 92%" },
        delay: (i % 3) * 0.06,
      });
    });
  }

  /* ===================== FOOTER ===================== */
  function initFooter() {
    gsap.from(".footer > *", {
      y: 24,
      opacity: 0,
      stagger: 0.12,
      duration: 0.8,
      ease: EASE,
      scrollTrigger: { trigger: ".footer", start: "top 88%" },
    });
  }

  /* ===================== GENERIC data-reveal fallback ===================== */
  function initRevealFallback() {
    $$("[data-reveal]").forEach((el) => {
      if (el.closest("#hero")) return;
      const dir = el.getAttribute("data-reveal");
      const from = { opacity: 0 };
      const to = { opacity: 1, duration: 0.75, ease: EASE, immediateRender: false };
      if (dir === "left") {
        from.x = -40;
        to.x = 0;
      } else if (dir === "right") {
        from.x = 40;
        to.x = 0;
      } else if (dir === "scale") {
        from.scale = 0.9;
        to.scale = 1;
      } else {
        from.y = 28;
        to.y = 0;
      }

      gsap.fromTo(el, from, {
        ...to,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
        onComplete: () => el.classList.add("is-revealed"),
      });
    });
  }

  function revealVisibleNow() {
    $$("[data-reveal]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
        gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1 });
        el.classList.add("is-revealed");
      }
    });
  }

  /* ===================== SECTION WIPES (track, news) ===================== */
  function initSectionWipes() {
    const wipes = [
      { sel: "#track", enter: "left" },
      { sel: "#news", enter: "top" },
    ];

    wipes.forEach(({ sel, enter }) => {
      const el = document.querySelector(sel);
      if (!el) return;

      const from =
        enter === "bottom"
          ? { yPercent: 28, opacity: 0.55 }
          : enter === "left"
            ? { xPercent: -22, opacity: 0.55 }
            : { yPercent: -22, opacity: 0.55 };

      gsap.set(el, from);

      gsap.to(el, {
        yPercent: 0,
        xPercent: 0,
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "top 52%",
          scrub: 0.85,
        },
      });
    });
  }

  /* ===================== BOOT ===================== */
  document.documentElement.classList.remove("no-gsap");

  document.addEventListener("DOMContentLoaded", () => {
    initHero();
    initBreaks();
    initSectionWipes();
    initSignal();
    initTrack();
    initNews();
    initHow();
    initPricing();
    initFaq();
    initFooter();
    initRevealFallback();
    revealVisibleNow();

    ScrollTrigger.refresh();
    revealVisibleNow();
  });

  window.AuremScroll = { bindChartDraw, registerNewsItems };
})();

if (typeof gsap === "undefined") {
  document.documentElement.classList.add("no-gsap");
}
