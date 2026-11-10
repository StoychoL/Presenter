// Range hero — "Cherry Aboard!" launch banner for Captain Morgan Spiced Gold & Pepsi MAX Cherry,
// shown at the top of the Range page (partnership.html, #range-hero).
//
// Self-contained: one global (window.RangeHero.mount), never touches Storage, and the page's
// render() only rebuilds #tier-sections, so the banner is mounted once and never re-rendered.
//
//   - Canvas background: red-over-black diagonal split (after the trade poster), tumbling
//     cherries, rising fizz, and a light sweep every few seconds. DPR-scaled, paused while
//     off-screen or the tab is hidden.
//   - The can is a DOM <img> on top: it floats, and can be dragged to tilt/slide in 3D, then
//     springs back. Pointer movement over the banner adds a little parallax.
//   - A tap (not a drag) calls opts.onTap — partnership.js scrolls to the product tile.
//   - prefers-reduced-motion: a still frame; dragging still tilts but snaps straight back.

(function () {
  // A tight cutout of images/Products/Single/RTDCMC.png (the product photo has a solid white
  // border around the can, invisible on the white product tiles but not on this red/black banner).
  const CAN_IMG = "images/Products/RTDCMC-hero.png";
  const RED = "#d52b1e";
  const RED_DARK = "#a3170e";
  const MAGENTA = "#c2187a";

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- canvas drawing ----

  function drawCherry(ctx, s, rot, alpha) {
    ctx.save();
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    // stems from a shared joint above the two fruits
    ctx.strokeStyle = "#5b3a12";
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.2);
    ctx.quadraticCurveTo(-s * 0.35, -s * 0.7, s * 0.15, -s * 1.15);
    ctx.moveTo(s * 0.6, s * 0.3);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.5, s * 0.15, -s * 1.15);
    ctx.stroke();
    // leaf
    ctx.fillStyle = "#2f8f3a";
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 1.15);
    ctx.quadraticCurveTo(s * 0.75, -s * 1.55, s * 1.05, -s * 1.05);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.85, s * 0.15, -s * 1.15);
    ctx.fill();
    // fruits
    [[-s * 0.55, s * 0.45], [s * 0.6, s * 0.55]].forEach(function (p) {
      const g = ctx.createRadialGradient(p[0] - s * 0.18, p[1] - s * 0.2, s * 0.05, p[0], p[1], s * 0.55);
      g.addColorStop(0, "#ff5a6a");
      g.addColorStop(0.55, "#d4142c");
      g.addColorStop(1, "#6d0010");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p[0], p[1], s * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(p[0] - s * 0.2, p[1] - s * 0.22, s * 0.12, s * 0.07, -0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function makeCherries(n) {
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({
        x: Math.random(), y: Math.random(),
        depth: 0.35 + Math.random() * 0.65,       // 0..1 — bigger, faster, more parallax when near
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.6,
        drift: Math.random() * Math.PI * 2
      });
    }
    return list.sort(function (a, b) { return a.depth - b.depth; });
  }

  function makeFizz(n) {
    const list = [];
    for (let i = 0; i < n; i++) list.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, v: 0.04 + Math.random() * 0.08 });
    return list;
  }

  function mount(root, opts) {
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = "1";
    opts = opts || {};
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const banner = el("section", "rh");
    banner.setAttribute("aria-label", "New: Captain Morgan Spiced Gold and Pepsi MAX Cherry. Tap to find it in the range.");
    const canvas = el("canvas", "rh-canvas");
    canvas.setAttribute("aria-hidden", "true");

    const copy = el("div", "rh-copy",
      '<p class="rh-kicker">Just landed</p>' +
      '<h2 class="rh-title">Cherry<br>Aboard!</h2>' +
      '<p class="rh-sub">Captain Morgan Spiced Gold <span class="rh-x">&times;</span> Pepsi MAX Cherry</p>' +
      '<div class="rh-chips"><span>&pound;2.25 RRP</span><span>5% ABV</span></div>');

    const stage = el("div", "rh-stage");
    const shadow = el("div", "rh-shadow");
    const can = el("img", "rh-can");
    can.src = CAN_IMG;
    can.alt = "Captain Morgan Spiced Gold and Pepsi MAX Cherry can";
    can.draggable = false;
    const badge = el("div", "rh-new", "<span>New</span>");
    stage.appendChild(shadow);
    stage.appendChild(can);
    stage.appendChild(badge);

    const footer = el("div", "rh-footer", '<span class="rh-tagline">Make your sales, sail.</span><span class="rh-cta">Find it in the range &rsaquo;</span>');

    banner.appendChild(canvas);
    banner.appendChild(copy);
    banner.appendChild(stage);
    banner.appendChild(footer);
    root.appendChild(banner);

    const ctx = canvas.getContext("2d");
    const cherries = makeCherries(9);
    const fizz = makeFizz(26);
    let W = 0, H = 0, dpr = 1;

    function resize() {
      const r = banner.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }

    // Eased pointer position over the banner, -1..1, for parallax.
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

    function drawBackground(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, H);

      // red top, slanted edge rising to the right; it breathes slowly
      const wob = reduce ? 0 : Math.sin(t * 0.0006) * H * 0.025;
      const yl = H * 0.74 + wob, yr = H * 0.46 - wob;
      const red = ctx.createLinearGradient(0, 0, W, H);
      red.addColorStop(0, RED);
      red.addColorStop(1, RED_DARK);
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, yr); ctx.lineTo(0, yl);
      ctx.closePath();
      ctx.fill();
      // magenta seam, the can's colour
      ctx.strokeStyle = MAGENTA;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, yl); ctx.lineTo(W, yr);
      ctx.stroke();

      // warm glow behind the can
      const cx = W * 0.74 + pointer.x * 6, cy = H * 0.5;
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.42);
      glow.addColorStop(0, "rgba(255,190,120,0.35)");
      glow.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    function drawSweep(t) {
      if (reduce) return;
      const period = 6500;
      const p = (t % period) / period;              // 0..1
      if (p > 0.35) return;                          // sweep for the first third of each period
      const x = -W * 0.4 + (p / 0.35) * W * 1.8;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(x - 60, 0, x + 60, H * 0.3);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function drawParticles(t, dt) {
      const step = reduce ? 0 : dt / 1000;
      fizz.forEach(function (f) {
        f.y -= f.v * step;
        if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.arc(f.x * W, f.y * H, f.r, 0, Math.PI * 2);
        ctx.fill();
      });
      const base = Math.min(W, H);
      cherries.forEach(function (c) {
        c.y -= (0.03 + c.depth * 0.05) * step;
        c.rot += c.spin * step;
        if (c.y < -0.15) { c.y = 1.15; c.x = Math.random(); }
        const sway = reduce ? 0 : Math.sin(t * 0.0008 + c.drift) * 0.02;
        const px = (c.x + sway) * W + pointer.x * c.depth * 14;
        const py = c.y * H + pointer.y * c.depth * 8;
        ctx.save();
        ctx.translate(px, py);
        drawCherry(ctx, base * (0.035 + c.depth * 0.05), c.rot, 0.45 + c.depth * 0.55);
        ctx.restore();
      });
    }

    // ---- can: float + drag with spring-back ----
    const drag = { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0, vx: 0, vy: 0, moved: false, t0: 0 };

    function applyCan(t) {
      const bob = reduce ? 0 : Math.sin(t * 0.0018) * 7;
      const sway = reduce ? 0 : Math.sin(t * 0.0011) * 3;
      const tx = clamp(drag.dx * 0.55, -70, 70);
      const ty = clamp(drag.dy * 0.35, -40, 40);
      const ry = clamp(drag.dx * 0.35, -38, 38);
      const rx = clamp(-drag.dy * 0.3, -22, 22);
      const rz = sway + clamp(drag.dx * 0.04, -8, 8);
      can.style.transform =
        "translate3d(" + (tx + pointer.x * 4) + "px," + (ty + bob) + "px,0) " +
        "perspective(700px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) rotateZ(" + rz + "deg)";
      const lift = (bob + 7) / 14;                 // 0 (low) .. 1 (high)
      shadow.style.transform = "translateX(" + tx * 0.6 + "px) scale(" + (1.05 - lift * 0.25) + ")";
      shadow.style.opacity = String(0.55 - lift * 0.2);
      copy.style.transform = "translate3d(" + (-pointer.x * 4) + "px," + (-pointer.y * 3) + "px,0)";
    }

    function springBack(dt) {
      if (drag.active) return false;
      if (reduce) { drag.dx = drag.dy = drag.vx = drag.vy = 0; return false; }
      // Damped spring (per-ms units), integrated in small sub-steps so it stays stable whatever
      // the frame rate: ~210ms natural period, damping ratio ~0.75 — one soft overshoot.
      const k = 0.0009, c = 0.045;
      let left = Math.min(dt, 64);
      while (left > 0) {
        const h = Math.min(4, left);
        drag.vx += (-k * drag.dx - c * drag.vx) * h;
        drag.vy += (-k * drag.dy - c * drag.vy) * h;
        drag.dx += drag.vx * h;
        drag.dy += drag.vy * h;
        left -= h;
      }
      const resting = Math.abs(drag.dx) < 0.3 && Math.abs(drag.dy) < 0.3 && Math.abs(drag.vx) < 0.01 && Math.abs(drag.vy) < 0.01;
      if (resting) { drag.dx = drag.dy = drag.vx = drag.vy = 0; }
      return !resting;
    }

    banner.addEventListener("pointerdown", function (e) {
      drag.active = true; drag.id = e.pointerId; drag.moved = false; drag.t0 = performance.now();
      drag.sx = e.clientX - drag.dx; drag.sy = e.clientY - drag.dy;
      drag.ox = e.clientX; drag.oy = e.clientY;
      try { banner.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      kick();
    });
    banner.addEventListener("pointermove", function (e) {
      const r = banner.getBoundingClientRect();
      pointer.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      pointer.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      if (drag.active && e.pointerId === drag.id) {
        drag.dx = e.clientX - drag.sx;
        drag.dy = e.clientY - drag.sy;
        if (Math.abs(e.clientX - drag.ox) + Math.abs(e.clientY - drag.oy) > 8) drag.moved = true;
      }
      kick();
    });
    function release(e) {
      if (!drag.active || (e && e.pointerId !== drag.id)) return;
      drag.active = false;
      const quick = performance.now() - drag.t0 < 450;
      if (e && e.type === "pointerup" && !drag.moved && quick && typeof opts.onTap === "function") opts.onTap();
      kick();
    }
    banner.addEventListener("pointerup", release);
    banner.addEventListener("pointercancel", release);
    banner.addEventListener("pointerleave", function () { pointer.tx = 0; pointer.ty = 0; kick(); });
    banner.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && typeof opts.onTap === "function") { e.preventDefault(); opts.onTap(); }
    });
    banner.tabIndex = 0;
    banner.setAttribute("role", "button");

    // ---- loop ----
    let visible = true, raf = 0, last = 0;

    function frame(t) {
      raf = 0;
      const dt = last ? Math.min(t - last, 64) : 16;
      last = t;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      const springing = springBack(dt);
      drawBackground(t);
      drawParticles(t, dt);
      drawSweep(t);
      applyCan(t);
      const pointerSettling = Math.abs(pointer.tx - pointer.x) > 0.01 || Math.abs(pointer.ty - pointer.y) > 0.01;
      const keepGoing = !reduce || drag.active || springing || pointerSettling;
      if (keepGoing && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function kick() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    resize();
    kick();
    window.addEventListener("resize", function () { resize(); kick(); });
    document.addEventListener("visibilitychange", kick);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }).observe(banner);
    }
  }

  window.RangeHero = { mount: mount };
})();
