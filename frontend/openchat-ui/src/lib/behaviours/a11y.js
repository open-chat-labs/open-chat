// Keyboard parity for custom controls: Enter/Space on any non-native element with an
// interactive role activates it, unless the component already handled the key.
// (Svelte export: a `use:pressable` action on the same elements.)
(function () {
  if (window.__ocA11y) return; window.__ocA11y = true;
  var ROLES = { button: 1, tab: 1, menuitem: 1, option: 1, switch: 1, checkbox: 1, radio: 1, link: 1 };
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var tag = el.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return;
    if (!ROLES[el.getAttribute("role")]) return;
    if (el.getAttribute("aria-disabled") === "true") return;
    if (e.key === " " && el.getAttribute("role") === "link") return;
    e.preventDefault();
    el.click();
  });

  // Hand-built modals (any [role=dialog][aria-modal=true] not managed by DialogShell):
  // move focus in on open, keep Tab inside the top-most one, return focus to the opener on close.
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var open = [];
  function scan() {
    var found = [].slice.call(document.querySelectorAll('[role="dialog"][aria-modal="true"]:not([data-oc-managed])'));
    found.forEach(function (d) {
      if (open.some(function (o) { return o.el === d; })) return;
      var rec = { el: d, back: document.activeElement };
      open.push(rec);
      setTimeout(function () {
        if (!d.isConnected || d.contains(document.activeElement)) return;
        var field = d.querySelector("input:not([type=hidden]):not([disabled]),textarea:not([disabled])");
        if (!field && !d.hasAttribute("tabindex")) d.setAttribute("tabindex", "-1");
        (field || d).focus({ preventScroll: true });
      }, 60);
    });
    open = open.filter(function (o) {
      if (o.el.isConnected) return true;
      if (o.back && o.back.isConnected && o.back.focus) setTimeout(function () { o.back.focus({ preventScroll: true }); }, 0);
      return false;
    });
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !open.length) return;
    var managed = window.__ocDialogs && window.__ocDialogs.length;
    var top = open[open.length - 1].el;
    if (managed && top.compareDocumentPosition && window.__ocDialogs[window.__ocDialogs.length - 1].boxRef.current && (top.compareDocumentPosition(window.__ocDialogs[window.__ocDialogs.length - 1].boxRef.current) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
    var els = [].slice.call(top.querySelectorAll(FOCUSABLE)).filter(function (x) { return x.offsetParent !== null; });
    if (!els.length) { e.preventDefault(); return; }
    var first = els[0], last = els[els.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !top.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !top.contains(a))) { e.preventDefault(); first.focus(); }
  });
})();
