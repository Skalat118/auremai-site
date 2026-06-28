/*
 * AuremAI — bull as section background (watermark), one canvas reparented per section.
 */

const BULL_VIVID = {
  saturate: 1.35,
  contrast: 1.08,
  brightness: 1.06,
  bgOpacity: 1,
};

const BULL_POSES = [
  {
    id: "hero",
    src: "assets/bull-pose-1.png?v=3",
    anchor: "hero-span",
    spanTop: ".hero__headline",
    spanBottom: ".hero__cta",
    cropTop: 1,
    anchorLeftTo: ".hero__copy",
    gapFromCopy: 56,
    insetRight: 12,
  },
  {
    id: "signal",
    src: "assets/bull-pose-2.png?v=3",
    anchor: "slot",
    slotSelector: ".signal__bull-slot",
    maxPx: 720,
    fillSlot: true,
    saturate: 1.05,
    contrast: 1,
    brightness: 1,
  },
  {
    id: "system",
    src: "assets/bull-pose-system.png?v=1",
    anchor: "slot",
    slotSelector: ".system__bull-slot",
    maxPx: 720,
    fillSlot: true,
    saturate: 1.05,
    contrast: 1,
    brightness: 1,
  },
  {
    id: "track",
    src: "assets/bull-pose-3.png?v=3",
    anchor: "slot",
    slotSelector: ".track__bull-slot",
    maxPx: 440,
    fillSlot: true,
    slotVAlign: "top",
    slotHAlign: "left",
  },
  {
    id: "news",
    src: "assets/bull-pose-4.png?v=3",
    anchor: "slot",
    slotSelector: ".news__bull-slot",
    maxPx: 420,
    fillSlot: true,
    slotVAlign: "top",
    slotHAlign: "right",
  },
];

const BULL_SECTIONS = ["hero", "signal", "system", "track", "news"];
const HIDE_SECTIONS = ["how", "pricing", "faq"];

function cmToPx(cm) {
  return (cm * 96) / 2.54;
}

class SectionBull {
  constructor(canvas, imgEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.imgEl = imgEl;
    this.pose = BULL_POSES[0];
    this.visible = false;
    this.loaded = false;
    this.currentSection = null;
    this.currentMount = null;
    this.cache = new Map();
    this.w = 0;
    this.h = 0;
    this.stageEl = document.getElementById("genie-bull-stage");
  }

  getMount(sectionId) {
    if (!sectionId) return null;
    return document.getElementById(`${sectionId}-bull-mount`);
  }

  mountCanvas(sectionId) {
    const mount = this.getMount(sectionId);
    if (mount) {
      mount.appendChild(this.canvas);
      this.currentMount = mount;
    } else if (this.stageEl) {
      this.stageEl.appendChild(this.canvas);
      this.currentMount = null;
    }
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.currentMount) {
      this.w = this.currentMount.clientWidth || 1;
      this.h = this.currentMount.clientHeight || 1;
    } else {
      this.w = window.innerWidth;
      this.h = window.innerHeight;
    }
    this.canvas.width = Math.max(1, this.w * dpr);
    this.canvas.height = Math.max(1, this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  preload(src) {
    if (this.cache.has(src)) return Promise.resolve(this.cache.get(src));
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        this.cache.set(src, im);
        resolve(im);
      };
      im.onerror = reject;
      im.src = src;
    });
  }

  getRecoloredGold(src, img) {
    const cacheKey = `${src}:gold-tonal-v3`;
    if (!this.recolorCache) this.recolorCache = new Map();
    if (this.recolorCache.has(cacheKey)) return this.recolorCache.get(cacheKey);
    if (!img?.naturalWidth) return img;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);

    let data;
    try {
      data = octx.getImageData(0, 0, w, h);
    } catch (e) {
      return img;
    }
    const d = data.data;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const GOLD_RAMP = [
      { t: 0.0, r: 96, g: 68, b: 10 },
      { t: 0.15, r: 142, g: 104, b: 22 },
      { t: 0.32, r: 184, g: 138, b: 32 },
      { t: 0.48, r: 212, g: 168, b: 67 },
      { t: 0.62, r: 224, g: 182, b: 68 },
      { t: 0.76, r: 232, g: 196, b: 104 },
      { t: 0.9, r: 248, g: 212, b: 96 },
      { t: 1.0, r: 255, g: 223, b: 102 },
    ];

    const goldAtLum = (L) => {
      const t = clamp(L, 0, 1);
      for (let s = 1; s < GOLD_RAMP.length; s++) {
        const hi = GOLD_RAMP[s];
        const lo = GOLD_RAMP[s - 1];
        if (t <= hi.t) {
          const f = (t - lo.t) / (hi.t - lo.t);
          return {
            r: lerp(lo.r, hi.r, f),
            g: lerp(lo.g, hi.g, f),
            b: lerp(lo.b, hi.b, f),
          };
        }
      }
      const last = GOLD_RAMP[GOLD_RAMP.length - 1];
      return { r: last.r, g: last.g, b: last.b };
    };

    const isBullSkin = (r, g, b) => {
      const L = lum(r, g, b);
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const redExcess = r - Math.max(g, b);

      // Horns and neutral whites only — tight so skin highlights still pass
      if (chroma < 34 && L > 0.54) return false;

      // Skin: maroon through light pink (include cheek highlights)
      if (r <= g || r <= b || chroma < 14 || L < 0.06) return false;
      if (redExcess < 8 || r < g * 1.03 || r < b * 1.03) return false;

      // Yellow belt — skip
      if (g > 150 && b < 90 && r / Math.max(g, 1) < 1.18) return false;

      return true;
    };

    const evenGoldLum = (L) => {
      // Compress dynamic range so highlights don't become blotchy bright spots
      const t = clamp(L, 0, 1);
      return clamp(0.2 + Math.pow(t, 0.88) * 0.56, 0.14, 0.78);
    };

    for (let y = 0; y < h; y++) {
      const yt = y / Math.max(1, h - 1);
      const gradShift = lerp(0.04, -0.03, yt);

      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        if (a < 8) continue;
        if (!isBullSkin(r, g, b)) continue;

        const mapped = goldAtLum(clamp(evenGoldLum(lum(r, g, b)) + gradShift, 0.08, 0.82));
        d[i] = Math.round(mapped.r);
        d[i + 1] = Math.round(mapped.g);
        d[i + 2] = Math.round(mapped.b);
      }
    }

    octx.putImageData(data, 0, 0);
    this.recolorCache.set(cacheKey, off);
    return off;
  }

  elementBoxInMount(selector) {
    const sec = document.getElementById(this.currentSection);
    const mount = this.currentMount;
    if (!sec || !mount) return null;

    const el = sec.querySelector(selector);
    if (!el) return null;

    const er = el.getBoundingClientRect();
    const mr = mount.getBoundingClientRect();
    return {
      left: er.left - mr.left,
      right: er.right - mr.left,
      top: er.top - mr.top,
      bottom: er.bottom - mr.top,
      center: er.top - mr.top + er.height / 2,
      width: er.width,
      height: er.height,
    };
  }

  containerRectInMount(selector = ".container") {
    return this.elementBoxInMount(selector);
  }

  headRectInMount(sectionId) {
    const sec = document.getElementById(sectionId);
    const mount = this.currentMount;
    if (!sec || !mount) return null;

    const head =
      sec.querySelector(".section__head") ||
      sec.querySelector(".hero__inner") ||
      sec.querySelector(".hero__copy");
    if (!head) return null;

    const hr = head.getBoundingClientRect();
    const mr = mount.getBoundingClientRect();
    return {
      top: hr.top - mr.top,
      bottom: hr.bottom - mr.top,
      center: hr.top - mr.top + hr.height / 2,
    };
  }

  headBottomInMount(sectionId) {
    const box = this.headRectInMount(sectionId);
    return box ? box.bottom : this.h * 0.28;
  }

  layout() {
    const img = this.imgEl;
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const pose = this.pose;
    let height = pose.heightRatio
      ? Math.min(this.h * pose.heightRatio, pose.maxPx ?? Infinity)
      : pose.maxPx ?? 400;
    let width = height * ratio;
    const side = pose.side || "right";
    const pad = Math.max(12, this.w * 0.04);
    let x = side === "right" ? this.w - width - pad : pad;
    let y;
    let cropTop;

    if (pose.anchor === "hero-span") {
      cropTop = pose.cropTop ?? 1;
      const croppedRatio = img.naturalWidth / (img.naturalHeight * cropTop);
      const topEl = this.elementBoxInMount(pose.spanTop);
      const botEl = this.elementBoxInMount(pose.spanBottom);
      const topY = topEl?.top ?? this.h * 0.12;
      const bottomY = botEl?.bottom ?? this.h * 0.72;

      height = Math.max(48, bottomY - topY);
      width = height * croppedRatio;

      const copy = pose.anchorLeftTo ? this.elementBoxInMount(pose.anchorLeftTo) : null;
      const gap = pose.gapFromCopy ?? 32;
      const maxW = copy
        ? this.w - copy.right - gap - (pose.insetRight ?? 8)
        : this.w - pad * 2;
      if (width > maxW) {
        width = maxW;
        height = width / croppedRatio;
      }

      x = copy ? copy.right + gap : this.w - width - pad;
      x = Math.min(x, this.w - width - (pose.insetRight ?? 8));
      y = bottomY - height;

      return { x, y, width, height, cropTop };
    }

    if (pose.anchor === "hero-bust") {
      cropTop = pose.cropTop ?? 1;
      const croppedRatio = img.naturalWidth / (img.naturalHeight * cropTop);
      height = Math.min(this.h * (pose.heightRatio ?? 0.8), pose.maxPx ?? 680);
      width = height * croppedRatio;
      if (pose.anchorLeftTo) {
        const copy = this.elementBoxInMount(pose.anchorLeftTo);
        if (copy) {
          x = copy.right + (pose.gapFromCopy ?? 28);
        } else {
          x = this.w - width - (pose.insetRight ?? 0);
        }
        x = Math.min(x, this.w - width - (pose.insetRight ?? 8));
      } else {
        x = this.w - width - (pose.insetRight ?? 0);
      }
      if (pose.anchorBottomTo) {
        const anchor = this.elementBoxInMount(pose.anchorBottomTo);
        y = anchor ? anchor.bottom - height + (pose.bottomOffset ?? 0) : this.h - height;
      } else if (pose.alignBottom) {
        y = this.h - height - (pose.bottomInset ?? 0);
      } else {
        y = this.h * (pose.vAlign ?? 0.46) - height / 2;
      }
      return { x, y, width, height, cropTop };
    }

    if (pose.anchor === "slot" && pose.slotSelector) {
      const box = this.elementBoxInMount(pose.slotSelector);
      if (box) {
        if (pose.fillSlot) {
          height = box.height * 0.98;
          width = height * ratio;
          if (width > box.width * 0.98) {
            width = box.width * 0.98;
            height = width / ratio;
          }
        } else {
          height = Math.min(box.height * 0.95, pose.maxPx ?? 280);
          width = height * ratio;
          if (width > box.width * 0.98) {
            width = box.width * 0.98;
            height = width / ratio;
          }
        }
        x = box.left + (box.width - width) / 2;
        y = box.top + (box.height - height) / 2;
        if (pose.slotHAlign === "right") x = box.right - width;
        else if (pose.slotHAlign === "left") x = box.left;
        if (pose.slotVAlign === "top") y = box.top;
        else if (pose.slotVAlign === "bottom") y = box.bottom - height;
        if (pose.shiftLeftCm) x -= cmToPx(pose.shiftLeftCm);
        return { x, y, width, height };
      }
    }

    if (pose.anchor === "below-head") {
      const zoneTop = this.headBottomInMount(this.currentSection) + 12;
      const zoneH = Math.max(this.h - zoneTop - 20, height);
      y = zoneTop + zoneH * 0.38 - height / 2;
    } else {
      y = this.h * 0.48 - height / 2;
    }

    if (pose.containIn) {
      const box = this.containerRectInMount(pose.containIn);
      if (box) {
        const inset = pose.insetRight ?? 16;
        x = pose.side === "right" ? box.right - width - inset : box.left + inset;
        x = Math.max(box.left, Math.min(x, box.right - width));
      }
    }

    if (pose.shiftLeftCm) x -= cmToPx(pose.shiftLeftCm);

    return { x, y, width, height, cropTop };
  }

  draw(rect) {
    const pose = this.pose;
    const fade = pose.bgOpacity ?? BULL_VIVID.bgOpacity;
    const cropTop = rect.cropTop ?? pose.cropTop ?? 1;
    const img = this.cache.get(pose.src) || this.imgEl;
    let source = img;

    if (pose.recolor === "gold" && img?.complete && img.naturalWidth) {
      source = this.getRecoloredGold(pose.src, img);
    }
    const srcW = source.naturalWidth ?? source.width;
    const srcFullH = source.naturalHeight ?? source.height;
    const srcH = srcFullH * cropTop;

    this.ctx.save();
    this.ctx.globalAlpha = fade;
    this.ctx.filter = `saturate(${pose.saturate ?? BULL_VIVID.saturate}) contrast(${pose.contrast ?? BULL_VIVID.contrast}) brightness(${pose.brightness ?? BULL_VIVID.brightness})`;
    this.ctx.drawImage(source, 0, 0, srcW, srcH, rect.x, rect.y, rect.width, rect.height);
    this.ctx.filter = "none";
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  showSection(sectionId) {
    const pose = BULL_POSES.find((p) => p.id === sectionId);
    if (!pose) return;
    if (this.visible && this.currentSection === sectionId && this.loaded) return;

    this.currentSection = sectionId;
    this.pose = pose;
    this.mountCanvas(sectionId);

    const cached = this.cache.get(pose.src);
    if (!cached) return;

    const apply = () => {
      this.loaded = true;
      this.visible = true;
      this.tick();
    };

    if (this.imgEl.src.includes(pose.src.split("/").pop()) && this.imgEl.complete) {
      apply();
      return;
    }

    this.imgEl.onload = apply;
    this.imgEl.src = pose.src;
  }

  hide() {
    this.visible = false;
    this.loaded = false;
    this.currentSection = null;
    this.mountCanvas(null);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  tick() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    if (!this.loaded || !this.visible || !this.currentMount) return;
    const img = this.cache.get(this.pose.src) || this.imgEl;
    if (!img?.complete || !img.naturalWidth) return;
    this.draw(this.layout());
  }

  start() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener(
      "scroll",
      () => {
        if (this.currentMount) this.resize();
      },
      { passive: true }
    );
    const loop = () => {
      this.tick();
      requestAnimationFrame(loop);
    };
    loop();
  }
}

function bindScroll(bull) {
  let active = null;

  const evaluate = () => {
    const vh = window.innerHeight;

    for (const id of HIDE_SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.72 && r.bottom > vh * 0.18) {
        if (active !== "hide") {
          active = "hide";
          bull.hide();
        }
        return;
      }
    }

    let best = null;
    let bestDist = Infinity;
    for (const id of BULL_SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 72 || r.top > vh - 32) continue;
      const vis = Math.min(r.bottom, vh) - Math.max(r.top, 72);
      if (vis < vh * 0.22) continue;
      const dist = Math.abs(r.top + r.height * 0.42 - vh * 0.5);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }

    if (best && best !== active) {
      active = best;
      bull.showSection(best);
    } else if (!best && active && active !== "hide") {
      active = null;
      bull.hide();
    }
  };

  Promise.all(BULL_POSES.map((p) => bull.preload(p.src))).then(() => {
    bull.showSection("hero");
    active = "hero";
    evaluate();
  });

  let scheduled = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        evaluate();
      });
    },
    { passive: true }
  );

  window.addEventListener("resize", evaluate);
}

function initSectionBull() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 768) return;

  const canvas = document.getElementById("genie-bull-canvas");
  const img = document.getElementById("genie-bull-source");
  if (!canvas || !img) return;

  const bull = new SectionBull(canvas, img);
  bull.start();
  bindScroll(bull);

  window.__sectionBull = bull;
}

document.addEventListener("DOMContentLoaded", initSectionBull);
