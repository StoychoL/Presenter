// Keeps the browser's *page* zoom pinned at 1 on the two map pages (map.html / manager-map.html).
//
// Why this exists: Leaflet sets `touch-action: none` on its container, so the browser performs no
// default touch behaviour at all over the map — no page pan, no page pinch-zoom. The map fills
// essentially the whole viewport, so once the visual viewport is zoomed past 1 (a stray two-finger
// pinch on the toolbar, a double-tap that slips past css/styles.css's touch-action: manipulation),
// there is nowhere left to pinch back out from. The sidebar is laid out in the layout viewport, so
// it sits off-screen, and the rep is left able to work the map but unable to reach any other page
// until they close and reopen the app — the exact bug this was written for.
//
// Snapping back is safe here specifically because page zoom is never useful on these pages: the
// map has its own zoom, and every other control is already at tap size. This is not a general
// "block pinch-zoom" (an accessibility regression) — maximum-scale is applied for two frames to
// force the snap, then removed, so pinch-zoom keeps working, it just can't get stuck.

function installPageZoomGuard() {
  const vv = window.visualViewport;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!vv || !meta) return;

  const baseContent = meta.getAttribute("content");
  let timer = null;

  function resetPageZoom() {
    meta.setAttribute("content", baseContent + ", maximum-scale=1");
    // Two frames: the first lets the browser apply the constrained viewport (which is what forces
    // the snap back to scale 1), the second restores the original so pinch-zoom isn't left
    // permanently disabled. Restoring any sooner and iOS Safari never acts on it.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        meta.setAttribute("content", baseContent);
        // Re-align the layout viewport too — a zoomed-in page is usually scrolled away from the
        // origin, which is what puts the sidebar out of reach.
        window.scrollTo(0, 0);
      });
    });
  }

  function checkScale() {
    // Debounced so this fires once the rep has finished the gesture, not on every intermediate
    // frame of a pinch (which would fight them mid-gesture and re-enter resetPageZoom repeatedly).
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (vv.scale > 1.01) resetPageZoom();
    }, 400);
  }

  vv.addEventListener("resize", checkScale);
  vv.addEventListener("scroll", checkScale);
}

window.installPageZoomGuard = installPageZoomGuard;
