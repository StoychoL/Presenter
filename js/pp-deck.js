// Drives the Partnership Program pitch deck's slide navigation (pp-deck.html): a horizontal
// scroll-snap filmstrip, advanced by the prev/next buttons, the dot indicators, left/right arrow
// keys, or a swipe — the same set of controls as the Sales Presenter Deck's page-by-page paging,
// adapted for a small fixed number of slides instead of a rendered PDF.

document.addEventListener("DOMContentLoaded", function () {
  const slidesEl = document.getElementById("ppd-slides");
  const slides = Array.prototype.slice.call(slidesEl.children);
  const dotsEl = document.getElementById("ppd-dots");
  const prevBtn = document.getElementById("ppd-prev");
  const nextBtn = document.getElementById("ppd-next");
  const counter = document.getElementById("ppd-counter");
  let current = 0;

  slides.forEach(function (_, i) {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "Go to slide " + (i + 1));
    b.setAttribute("aria-current", i === 0 ? "true" : "false");
    b.addEventListener("click", function () { goTo(i); });
    dotsEl.appendChild(b);
  });
  const dotButtons = Array.prototype.slice.call(dotsEl.children);

  function update(i) {
    current = i;
    dotButtons.forEach(function (b, idx) { b.setAttribute("aria-current", idx === i ? "true" : "false"); });
    counter.textContent = (i + 1) + " / " + slides.length;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  prevBtn.addEventListener("click", function () { goTo(current - 1); });
  nextBtn.addEventListener("click", function () { goTo(current + 1); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") goTo(current + 1);
    if (e.key === "ArrowLeft") goTo(current - 1);
  });

  let scrollTimer = null;
  slidesEl.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      const idx = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
      if (idx !== current) update(idx);
    }, 80);
  });

  update(0);
});
