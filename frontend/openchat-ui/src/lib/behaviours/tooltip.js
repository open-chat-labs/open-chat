// Plain-label tooltips for every element with a title (icon buttons, status icons, chips).
// 400ms hover delay, shows on keyboard focus too; one tooltip at a time; Esc / press / scroll hide it.
// The native title is moved to data-tip so the browser tooltip never doubles up; aria-label is kept.
// Visual spec lives in lib/Tooltip.dc.html. (Svelte export: a `use:tooltip` action with the same rules.)
(function () {
  if (window.__ocTip) return; window.__ocTip = true;
  var DELAY = 400, GAP = 8, M = 8;
  var tip = null, timer = null, current = null;
  function el() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.setAttribute("role", "tooltip");
    tip.id = "oc-tooltip";
    tip.style.cssText = "position:fixed;z-index:200;left:0;top:0;max-width:240px;padding:6px 9px;border-radius:7px;font:600 12px/1.3 'Plus Jakarta Sans',system-ui,sans-serif;pointer-events:none;white-space:normal;text-wrap:balance;opacity:0;transform:translateY(2px);transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 6px 20px rgba(0,0,0,.28)";
    document.body.appendChild(tip);
    return tip;
  }
  function adopt(t) {
    var title = t.getAttribute("title");
    if (title) {
      t.setAttribute("data-tip", title);
      t.removeAttribute("title");
      if (!t.hasAttribute("aria-label") && !(t.textContent || "").trim()) t.setAttribute("aria-label", title);
    }
    return t.getAttribute("data-tip");
  }
  function target(node) {
    while (node && node !== document.body && node.nodeType === 1) {
      if (node.hasAttribute("title") || node.hasAttribute("data-tip")) return node;
      node = node.parentNode;
    }
    return null;
  }
  function show(t) {
    var text = adopt(t);
    if (!text || !t.isConnected) return;
    var d = el(), cs = getComputedStyle(t);
    d.textContent = text;
    // theme lives on the app root, not body: borrow the target's resolved tokens (inverted surface)
    d.style.background = cs.getPropertyValue("--ink").trim() || "#ECECF1";
    d.style.color = cs.getPropertyValue("--surface-1").trim() || "#0e0e12";
    d.style.opacity = "0";
    var r = t.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
    var x = r.left + r.width / 2 - w / 2, y = r.top - h - GAP, below = false;
    if (y < M) { y = r.bottom + GAP; below = true; }
    x = Math.max(M, Math.min(x, window.innerWidth - M - w));
    d.style.left = Math.round(x) + "px"; d.style.top = Math.round(y) + "px";
    d.style.transform = below ? "translateY(-2px)" : "translateY(2px)";
    t.setAttribute("aria-describedby", "oc-tooltip");
    requestAnimationFrame(function () { d.style.opacity = "1"; d.style.transform = "translateY(0)"; });
    current = t;
  }
  function hide() {
    clearTimeout(timer); timer = null;
    if (current) { current.removeAttribute("aria-describedby"); current = null; }
    if (tip) tip.style.opacity = "0";
  }
  function arm(t) {
    if (t === current) return;
    hide();
    adopt(t);
    timer = setTimeout(function () { show(t); }, DELAY);
  }
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType === "touch") return;
    var t = target(e.target);
    if (t) arm(t); else if (current || timer) hide();
  });
  document.addEventListener("pointerout", function (e) {
    var t = target(e.target);
    if (!t) return;
    var to = e.relatedTarget;
    if (to && t.contains(to)) return;
    hide();
  });
  document.addEventListener("focusin", function (e) {
    var t = target(e.target);
    if (t && t === e.target && t.matches(":focus-visible")) arm(t);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("scroll", hide, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  window.addEventListener("blur", hide);
})();
