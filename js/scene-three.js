/*
 * AuremAI — ambient Three.js layer: gold particle field + wire lattice.
 * Fixed behind content; fades as the user scrolls past the hero.
 */

(function initSceneThree() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("scene-canvas");
  if (!canvas || reduced || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  camera.position.z = 14;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  /* --- gold dust --- */
  const COUNT = 2800;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 6 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.6 - 4;
    seeds[i] = Math.random();
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xe8c468,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* --- wire torus knot (aurum lattice) --- */
  const knotGeo = new THREE.TorusKnotGeometry(2.8, 0.08, 160, 24, 2, 5);
  const knotMat = new THREE.MeshBasicMaterial({
    color: 0xd4a843,
    wireframe: true,
    transparent: true,
    opacity: 0.14,
  });
  const knot = new THREE.Mesh(knotGeo, knotMat);
  knot.position.set(4.5, 0.5, -6);
  knot.rotation.x = 0.6;
  scene.add(knot);

  /* --- faint ring --- */
  const ringGeo = new THREE.RingGeometry(5.5, 5.52, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -1.2;
  scene.add(ring);

  let scrollT = 0;
  let mouseX = 0;
  let mouseY = 0;
  let w = 0;
  let h = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = (e.clientX / w - 0.5) * 2;
      mouseY = (e.clientY / h - 0.5) * 2;
    },
    { passive: true }
  );

  function bindScrollFade() {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.create({
        start: 0,
        end: "+=120%",
        onUpdate: (self) => {
          scrollT = self.progress;
        },
      });
      return;
    }
    window.addEventListener(
      "scroll",
      () => {
        const max = document.documentElement.scrollHeight - window.innerHeight || 1;
        scrollT = Math.min(1, window.scrollY / (window.innerHeight * 1.2));
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindScrollFade);
  } else {
    bindScrollFade();
  }

  resize();

  const clock = new THREE.Clock();

  function tick() {
    const t = clock.getElapsedTime();
    const fade = Math.max(0, 1 - scrollT * 1.35);
    dustMat.opacity = 0.55 * fade;
    knotMat.opacity = 0.14 * fade;
    ringMat.opacity = 0.06 * fade;
    canvas.style.opacity = String(fade);

    dust.rotation.y = t * 0.04 + scrollT * 0.8;
    dust.rotation.x = Math.sin(t * 0.08) * 0.08;
    knot.rotation.y = t * 0.12;
    knot.rotation.z = t * 0.06;
    ring.rotation.z = t * 0.03;

    camera.position.x = mouseX * 0.6;
    camera.position.y = -mouseY * 0.35 + scrollT * 1.2;
    camera.lookAt(0, 0, -2);

    /* gentle particle drift */
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      pos[i * 3 + 1] += Math.sin(t * 0.5 + s * 20) * 0.0008;
    }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();

  window.__auremScene = { setScroll: (t) => { scrollT = t; } };
})();
