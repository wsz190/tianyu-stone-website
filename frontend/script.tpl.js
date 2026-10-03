/* ==========================================================================
   SCRIPT
   Sections: helpers · loader · nav · hero (Three.js) · reveals · parallax
             · light · stats · boot
   Depends on: THREE (r128), gsap 3, and business.js (loaded before this file).
   Every optional dependency degrades gracefully: without WebGL the slab falls
   back to a CSS image, without GSAP content simply shows with no animation.
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     CONFIG — tweak the look here
     ------------------------------------------------------------------------ */
  const CONFIG = {
    texture: "assets/marble.jpg",
    loader: { minMs: 1600, maxMs: 4500 },
    camera: { fov: 30, z: 12 },
    slab: { width: 3.4, height: 5.6, depth: 0.14, bevel: 0.03 },
    swayAmount: 0.6,        // radians of slow rotation each side
    swaySpeed: 0.17
  };

  /* ------------------------------------------------------------------------
     HELPERS
     ------------------------------------------------------------------------ */
  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasIO = "IntersectionObserver" in window;
  const hasGSAP = typeof window.gsap !== "undefined";
  const canMotion = hasGSAP && hasIO && !reduceMotion;

  const view = { h: window.innerHeight, heroProgress: 0 };
  const ticks = [];   // functions run once per animation frame

  function watchVisible(el, cb, margin = "0px") {
    if (!hasIO) { cb(true); return; }
    new IntersectionObserver((entries) => {
      cb(entries[entries.length - 1].isIntersecting);
    }, { rootMargin: margin }).observe(el);
  }

  function tween(from, to, ms, ease, onUpdate, onDone) {
    const t0 = performance.now();
    (function step(now) {
      const p = clamp((now - t0) / ms, 0, 1);
      onUpdate(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    })(t0);
  }

  /* ------------------------------------------------------------------------
     HERO — Three.js marble slab
     ------------------------------------------------------------------------ */
  function roundedRectShape(w, h, r) {
    const x = -w / 2, y = -h / 2, s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Generated marble, used if assets/marble.jpg cannot be read (or on file://)
  function makeProceduralMarble() {
    const w = 1024, h = 1686;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");

    let seed = 11;
    const rnd = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    g.fillStyle = "#e6e0d5";
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 44; i++) {
      const x = rnd() * w, y = rnd() * h, r = 120 + rnd() * 260;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${200 + rnd() * 40 | 0},${192 + rnd() * 36 | 0},${176 + rnd() * 30 | 0},.24)`);
      grad.addColorStop(1, "rgba(230,224,213,0)");
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    g.lineCap = "round";
    g.lineJoin = "round";
    for (let v = 0; v < 10; v++) {
      const major = v < 3;
      let x = rnd() * w, y = -20, a = Math.PI / 2 + (rnd() - 0.5) * 0.9;
      g.strokeStyle = `rgba(${68 + rnd() * 30 | 0},${62 + rnd() * 24 | 0},${56 + rnd() * 20 | 0},${major ? 0.5 : 0.26})`;
      g.lineWidth = (major ? 2.8 : 1.1) * (0.6 + rnd());
      g.beginPath();
      g.moveTo(x, y);
      while (y < h + 20) {
        a = clamp(a + (rnd() - 0.5) * 0.55, 0.3, Math.PI - 0.3);
        x += Math.cos(a) * 14;
        y += Math.sin(a) * 14;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  function makeShadowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 18, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,0,0,.8)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  // Studio-style environment: dark room, soft boxes that reflect in the polished stone
  function buildEnvironment(renderer) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = new THREE.Scene();
      env.add(new THREE.Mesh(
        new THREE.BoxGeometry(34, 34, 34),
        new THREE.MeshBasicMaterial({ color: 0x14120f, side: THREE.BackSide })
      ));
      const panel = (w, h, color, k, x, y, z) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
        );
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(14, 9, 0xfff3e0, 6, 8, 7, 9);       // key soft box
      panel(3, 16, 0xe2c79a, 5, -11, 1, -3);    // warm strip
      panel(16, 5, 0xffffff, 2.5, 0, 13, 2);    // overhead
      panel(26, 14, 0xf4ece0, 1.3, 0, 1, 15);   // broad front fill
      const tex = pmrem.fromScene(env, 0.035).texture;
      pmrem.dispose();
      return tex;
    } catch (err) {
      return null;
    }
  }

  function initHero() {
    const hero = $("#hero");
    const canvas = $("#hero-canvas");
    const api = { ready: Promise.resolve(), intro: { rot: 0, rise: 0 }, update() {} };

    if (!hero || !canvas || typeof THREE === "undefined") {
      root.classList.add("no-webgl");
      return api;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      root.classList.add("no-webgl");
      return api;
    }

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      root.classList.add("no-webgl");
    });

    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);

    const { width: W, height: H, depth: D, bevel: B } = CONFIG.slab;
    const CAM_Z = CONFIG.camera.z;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 60);
    camera.position.set(0, 0, CAM_Z);

    const envTex = buildEnvironment(renderer);
    if (envTex) scene.environment = envTex;

    // Lights
    scene.add(new THREE.HemisphereLight(0xfff4e3, 0x1a1712, 0.45));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd8b98a, 2.2);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    // Slab geometry: rounded outline, real bevel, planar UVs so the texture reads as one cut face
    const geometry = new THREE.ExtrudeGeometry(roundedRectShape(W, H, 0.04), {
      depth: D,
      bevelEnabled: true,
      bevelThickness: B,
      bevelSize: B,
      bevelOffset: 0,
      bevelSegments: 5,
      curveSegments: 6,
      steps: 1
    });
    geometry.translate(0, 0, -D / 2);

    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
    }
    uv.needsUpdate = true;

    const faceMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9d3c7,
      roughness: 0.24,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.9
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xb4ad9f,
      roughness: 0.5,
      metalness: 0,
      envMapIntensity: 0.55
    });

    const slab = new THREE.Mesh(geometry, [faceMat, edgeMat]);

    const pivot = new THREE.Group();
    pivot.add(slab);

    // Soft drop shadow on the "wall" behind the slab
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85 })
    );
    shadow.scale.set(W * 1.4, H * 1.22, 1);
    shadow.position.set(-0.5, -0.4, -0.7);

    const stage = new THREE.Group();
    stage.add(shadow, pivot);
    scene.add(stage);

    // Texture (with guaranteed fallback)
    const texturePromise = new Promise((resolve) => {
      const fallback = () => resolve(makeProceduralMarble());
      if (window.location.protocol === "file:") { fallback(); return; }   // WebGL cannot read file:// images
      new THREE.TextureLoader().load(CONFIG.texture, resolve, undefined, fallback);
    });

    function applyTexture(tex) {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

      // "cover" fit so the photo is never stretched onto the slab
      const img = tex.image || {};
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const slabAspect = W / H, imgAspect = iw / ih;
      if (imgAspect > slabAspect) {
        tex.repeat.set(slabAspect / imgAspect, 1);
        tex.offset.set((1 - tex.repeat.x) / 2, 0);
      } else {
        tex.repeat.set(1, imgAspect / slabAspect);
        tex.offset.set(0, (1 - tex.repeat.y) / 2);
      }

      faceMat.map = tex;
      faceMat.color.set(0xffffff);
      edgeMat.map = tex;
      faceMat.needsUpdate = true;
      edgeMat.needsUpdate = true;
    }

    // Layout: slab sits right of the headline on desktop, above it on mobile
    const layoutState = { x: 0, y: 0, scale: 1, viewH: 1 };
    const title = $(".hero__title");
    let needsLayout = true;
    let needsRender = true;

    function layout() {
      const w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fov / 2)) * CAM_Z;
      const viewW = viewH * camera.aspect;
      const perPx = viewH / h;
      let scale, x, y;

      if (w >= 861 && camera.aspect >= 1.05) {
        scale = Math.min((viewH * 0.76) / H, (viewW * 0.36) / W);
        x = viewW * 0.27;
        y = viewH * 0.015;
      } else {
        const heroTop = hero.getBoundingClientRect().top;
        const titleRect = title ? title.getBoundingClientRect() : null;
        const topPx = 86;
        const bottomPx = titleRect ? titleRect.top - heroTop + titleRect.height * 0.55 : h * 0.5;
        const slabPx = clamp(Math.min(bottomPx - topPx, w), 200, h * 0.7);
        scale = (slabPx * perPx) / H;
        x = viewW * 0.17;
        y = (h / 2 - (topPx + slabPx / 2)) * perPx;
      }

      Object.assign(layoutState, { x, y, scale, viewH });
      needsRender = true;
    }

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => { needsLayout = true; });
      ro.observe(hero);
      if (title) ro.observe(title);
    } else {
      window.addEventListener("resize", () => { needsLayout = true; });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { needsLayout = true; });
    }

    // Pointer parallax (desktop only, very small)
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer && !reduceMotion) {
      window.addEventListener("pointermove", (e) => {
        ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    let visible = true;
    watchVisible(hero, (v) => { visible = v; });

    api.update = (now) => {
      if (needsLayout) { layout(); needsLayout = false; }
      if (!visible && !needsRender) return;
      needsRender = false;

      const t = now / 1000;
      const hp = view.heroProgress;
      const calm = reduceMotion ? 0 : 1;

      ptr.x = lerp(ptr.x, ptr.tx, 0.05);
      ptr.y = lerp(ptr.y, ptr.ty, 0.05);

      pivot.rotation.y = -0.4 + Math.sin(t * CONFIG.swaySpeed) * CONFIG.swayAmount * calm
        + ptr.x * 0.12 + hp * 0.9 + api.intro.rot;
      pivot.rotation.x = 0.05 - ptr.y * 0.04 + Math.sin(t * 0.12) * 0.012 * calm;

      stage.position.set(
        layoutState.x,
        layoutState.y + Math.sin(t * 0.45) * 0.035 * calm + api.intro.rise + hp * layoutState.viewH * 0.06,
        0
      );
      stage.scale.setScalar(layoutState.scale * (1 - hp * 0.08));

      renderer.render(scene, camera);
    };

    // Ready = texture applied + shaders compiled with one warm-up frame
    api.ready = texturePromise.then((tex) => {
      applyTexture(tex);
      layout();
      needsLayout = false;
      api.update(performance.now());
    });

    return api;
  }

  /* ------------------------------------------------------------------------
     NAV + MOBILE MENU
     ------------------------------------------------------------------------ */
  function initNav() {
    const toggle = $(".nav__toggle");
    const menu = $("#menu");
    if (!toggle || !menu) return;

    const setOpen = (open) => {
      root.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
      menu.setAttribute("aria-hidden", String(!open));
      if ("inert" in menu) menu.inert = !open;
    };

    setOpen(false);
    toggle.addEventListener("click", () => setOpen(!root.classList.contains("menu-open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

    const desktop = window.matchMedia("(min-width: 861px)");
    if (desktop.addEventListener) {
      desktop.addEventListener("change", (e) => { if (e.matches) setOpen(false); });
    }
  }

  /* ------------------------------------------------------------------------
     STATS — count-up numerals (reads BUSINESS.stats through the DOM)
     ------------------------------------------------------------------------ */
  const counters = new Map();

  function initStats() {
    $$(".stat__value").forEach((el) => {
      const m = el.textContent.trim().match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
      if (!m) return;

      const target = parseFloat(m[2].replace(/,/g, ""));
      const decimals = (m[2].split(".")[1] || "").length;
      const format = (v) => v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

      const make = (cls, text) => {
        const s = document.createElement("span");
        if (cls) s.className = cls;
        s.textContent = text;
        return s;
      };

      const num = make("stat__num", format(target));
      el.textContent = "";
      if (m[1]) el.append(make("", m[1]));
      el.append(num);
      if (m[3].trim()) el.append(make("stat__suffix", m[3].trim()));

      counters.set(el, { num, target, format });
    });
  }

  /* ------------------------------------------------------------------------
     REVEALS — restrained, one motion language: lines slide up, images unveil,
     small text fades, rules draw, numbers count.
     Hidden states are set by GSAP itself, so if JS/GSAP fails nothing stays hidden.
     ------------------------------------------------------------------------ */
  function initReveals() {
    if (!canMotion) return;

    const of = (type) => $$(`[data-reveal="${type}"]`);

    gsap.set(of("lines").flatMap((el) => $$(".line__inner", el)), { yPercent: 112 });
    gsap.set(of("fade"), { opacity: 0, y: 24 });
    gsap.set(of("image"), { "--curtain": 1 });
    gsap.set(of("rule"), { scaleX: 0 });
    counters.forEach((c) => { c.num.textContent = c.format(0); });

    function reveal(el) {
      const delay = parseFloat(el.dataset.delay) || 0;
      switch (el.dataset.reveal) {
        case "lines":
          gsap.to($$(".line__inner", el), { yPercent: 0, duration: 1.4, ease: "power4.out", stagger: 0.1, delay });
          break;
        case "fade":
          gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", delay });
          break;
        case "image":
          gsap.to(el, { "--curtain": 0, duration: 1.5, ease: "power3.inOut", delay });
          break;
        case "rule":
          gsap.to(el, { scaleX: 1, duration: 1.6, ease: "power3.inOut", delay });
          break;
        case "count": {
          const c = counters.get(el);
          if (!c) break;
          const state = { n: 0 };
          gsap.to(state, {
            n: c.target,
            duration: 2.4,
            ease: "power2.out",
            delay,
            onUpdate: () => { c.num.textContent = c.format(state.n); }
          });
          break;
        }
      }
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        reveal(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });

    $$("[data-reveal]").forEach((el) => io.observe(el));
  }

  // Emergency exit: show everything exactly as authored
  function revealAll(hero) {
    if (hero) { hero.intro.rot = 0; hero.intro.rise = 0; }
    if (hasGSAP) gsap.killTweensOf("*");
    $$("[data-reveal], [data-reveal] .line__inner, .hero__label, .hero__title .line__inner, .hero__copy, .hero__actions, .hero__foot, .nav, #hero-canvas")
      .forEach((el) => {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.removeProperty("--curtain");
      });
    counters.forEach((c) => { c.num.textContent = c.format(c.target); });
  }

  /* ------------------------------------------------------------------------
     PARALLAX — images drift slightly inside their frames
     ------------------------------------------------------------------------ */
  function initParallax() {
    if (reduceMotion) return () => {};
    const active = new Set();

    $$("[data-parallax]").forEach((img) => {
      const item = { img, frame: img.parentElement };
      watchVisible(item.frame, (v) => { if (v) active.add(item); else active.delete(item); }, "20% 0px");
    });

    return () => {
      active.forEach(({ img, frame }) => {
        const r = frame.getBoundingClientRect();
        const p = clamp((view.h - r.top) / (view.h + r.height), 0, 1);
        const amp = 0.08 * (parseFloat(img.dataset.parallax) || 1);
        img.style.transform = `translate3d(0, ${((0.5 - p) * 2 * amp * r.height).toFixed(1)}px, 0)`;
      });
    };
  }

  /* ------------------------------------------------------------------------
     LIGHT — the pool of light in the experience section
     ------------------------------------------------------------------------ */
  function initLight() {
    const stage = $("#experience-stage");
    if (!stage || reduceMotion) return;

    const cur = { x: 0.62, y: 0.42 };
    const tgt = { x: 0.62, y: 0.42 };
    let hovering = false;
    let visible = false;

    watchVisible(stage, (v) => { visible = v; });

    if (finePointer) {
      stage.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        tgt.x = (e.clientX - r.left) / r.width;
        tgt.y = (e.clientY - r.top) / r.height;
        hovering = true;
      });
      stage.addEventListener("pointerleave", () => { hovering = false; });
    }

    ticks.push(() => {
      if (!visible) return;
      if (!hovering) {
        const r = stage.getBoundingClientRect();
        const p = clamp((view.h - r.top) / (view.h + r.height), 0, 1);
        tgt.x = 0.18 + p * 0.64;
        tgt.y = 0.28 + Math.sin(p * Math.PI) * 0.34;
      }
      cur.x = lerp(cur.x, tgt.x, 0.07);
      cur.y = lerp(cur.y, tgt.y, 0.07);
      stage.style.setProperty("--lx", (cur.x * 100).toFixed(2) + "%");
      stage.style.setProperty("--ly", (cur.y * 100).toFixed(2) + "%");
    });
  }

  /* ------------------------------------------------------------------------
     HERO INTRO — the one orchestrated cinematic moment
     ------------------------------------------------------------------------ */
  function prepareIntro(hero) {
    if (!canMotion) return;
    gsap.set(".hero__label", { opacity: 0, y: 14 });
    gsap.set(".hero__title .line__inner", { yPercent: 112 });
    gsap.set([".hero__copy", ".hero__actions"], { opacity: 0, y: 22 });
    gsap.set(".hero__foot", { opacity: 0 });
    gsap.set(".nav", { opacity: 0 });
    gsap.set("#hero-canvas", { opacity: 0 });
    hero.intro.rot = -0.9;
    hero.intro.rise = 0.5;
  }

  function playIntro(hero) {
    if (!canMotion) return;
    gsap.timeline({ delay: 0.5, defaults: { ease: "power3.out" } })
      .to(hero.intro, { rot: 0, rise: 0, duration: 3.2, ease: "power3.out" }, 0)
      .to("#hero-canvas", { opacity: 1, duration: 2.2, ease: "power2.out" }, 0)
      .to(".nav", { opacity: 1, duration: 1.4 }, 0.3)
      .to(".hero__label", { opacity: 1, y: 0, duration: 1.1 }, 0.25)
      .to(".hero__title .line__inner", { yPercent: 0, duration: 1.6, ease: "power4.out", stagger: 0.12 }, 0.3)
      .to([".hero__copy", ".hero__actions"], { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 1.0)
      .to(".hero__foot", { opacity: 1, duration: 1.2 }, 1.4);
  }

  /* ------------------------------------------------------------------------
     LOADER — can never trap the user:
       1. resolves when fonts + page + slab are ready (each capped at maxMs)
       2. a hard setTimeout fires regardless of any promise
       3. a pure-CSS animation hides the loader even if this file never runs
     ------------------------------------------------------------------------ */
  function initLoader(hero) {
    const loader = $("#loader");
    const countEl = $("#loader-count");
    const bar = $("#loader-bar");
    const { minMs, maxMs } = CONFIG.loader;

    let revealed = false;
    let shown = 0;

    const setProgress = (v) => {
      shown = v;
      if (countEl) countEl.textContent = String(Math.round(v)).padStart(3, "0");
      if (bar) bar.style.transform = `scaleX(${v / 100})`;
    };

    const finish = () => {
      if (revealed) return;
      revealed = true;
      setProgress(100);
      root.classList.add("is-loaded");
      try { playIntro(hero); } catch (err) { revealAll(hero); }
      setTimeout(() => { if (loader) loader.hidden = true; }, 1600);
    };

    const capped = (p) => Promise.race([Promise.resolve(p).catch(() => {}), wait(maxMs)]);
    const pageLoaded = document.readyState === "complete"
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

    tween(0, 88, minMs + 500, easeOutCubic, setProgress);

    Promise.all([capped(pageLoaded), capped(fontsReady), capped(hero.ready), wait(minMs)])
      .then(() => tween(shown, 100, 450, easeOutCubic, setProgress, finish))
      .catch(finish);

    setTimeout(finish, maxMs + 1500);   // guaranteed exit
  }

  /* ------------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------------ */
  function boot() {
    const safe = (fn) => { try { return fn(); } catch (err) { console.error(err); } };

    safe(initNav);
    safe(initStats);
    safe(initReveals);
    const hero = safe(initHero) || { ready: Promise.resolve(), intro: { rot: 0, rise: 0 }, update() {} };
    safe(() => prepareIntro(hero));
    const updateParallax = safe(initParallax) || (() => {});
    safe(initLight);

    // Scroll-driven bits (hero exit, parallax) run only when scrolling
    const heroEl = $("#hero");
    const heroText = $$(".hero__label, .hero__title, .hero__lower");
    let scrollDirty = true;
    window.addEventListener("scroll", () => { scrollDirty = true; }, { passive: true });
    window.addEventListener("resize", () => { view.h = window.innerHeight; scrollDirty = true; });

    ticks.push(hero.update);
    ticks.push(() => {
      if (!scrollDirty) return;
      scrollDirty = false;

      const y = window.scrollY || window.pageYOffset || 0;
      view.heroProgress = heroEl ? clamp(y / Math.max(heroEl.offsetHeight, 1), 0, 1) : 0;

      if (!reduceMotion && y < view.h * 1.5) {
        heroText.forEach((el) => { el.style.translate = `0 ${(y * 0.14).toFixed(1)}px`; });
        const lower = $(".hero__lower");
        if (lower) lower.style.opacity = String(clamp(1 - view.heroProgress * 1.3, 0, 1));
      }
      updateParallax();
    });

    (function loop(now) {
      requestAnimationFrame(loop);
      for (let i = 0; i < ticks.length; i++) {
        try { ticks[i](now); } catch (err) { ticks.splice(i, 1); i--; console.error(err); }
      }
    })(performance.now());

    initLoader(hero);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
