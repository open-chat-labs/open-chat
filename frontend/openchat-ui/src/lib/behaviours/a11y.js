// Keyboard parity for custom controls: Enter/Space on any non-native element with an
// interactive role activates it, unless the component already handled the key.
// Installed once per page by installA11y() (lib/index.ts calls it on import; safe to call again, no-op without a DOM).
export function installA11y() {
  if (typeof window === "undefined" || window.__ocA11y) return; window.__ocA11y = true;
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
  var SELECTOR = '[role="dialog"][aria-modal="true"]:not([data-oc-managed])';
  var open = [];
  function adopt(d) {
    if (open.some(function (o) { return o.el === d; })) return;
    var rec = { el: d, back: document.activeElement };
    open.push(rec);
    setTimeout(function () {
      if (!d.isConnected || d.contains(document.activeElement)) return;
      var field = d.querySelector("input:not([type=hidden]):not([disabled]),textarea:not([disabled])");
      if (!field && !d.hasAttribute("tabindex")) d.setAttribute("tabindex", "-1");
      (field || d).focus({ preventScroll: true });
    }, 60);
  }
  function dialogsIn(node) {
    if (node.nodeType !== 1) return [];
    var found = [].slice.call(node.querySelectorAll(SELECTOR));
    if (node.matches(SELECTOR)) found.unshift(node);
    return found;
  }
  function prune() {
    open = open.filter(function (o) {
      if (o.el.isConnected) return true;
      if (o.back && o.back.isConnected && o.back.focus) setTimeout(function () { o.back.focus({ preventScroll: true }); }, 0);
      return false;
    });
  }
  dialogsIn(document.documentElement).forEach(adopt);
  // only the added subtrees are searched, so busy chats (new messages, timers, waveforms) stay cheap
  new MutationObserver(function (records) {
    var removed = false;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      for (var j = 0; j < r.addedNodes.length; j++) dialogsIn(r.addedNodes[j]).forEach(adopt);
      if (r.removedNodes.length) removed = true;
    }
    if (removed && open.length) prune();
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !open.length) return;
    var managed = window.__ocDialogs && window.__ocDialogs.length;
    var top = open[open.length - 1].el;
    // a self-managed dialog (DialogShell, PuzzleDialog) traps its own focus; entries may carry boxRef.current
    var entry = managed && window.__ocDialogs[window.__ocDialogs.length - 1];
    var box = entry && entry.boxRef && entry.boxRef.current;
    if (box && top.compareDocumentPosition && (top.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
    var els = [].slice.call(top.querySelectorAll(FOCUSABLE)).filter(function (x) { return x.offsetParent !== null; });
    if (!els.length) { e.preventDefault(); return; }
    var first = els[0], last = els[els.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !top.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !top.contains(a))) { e.preventDefault(); first.focus(); }
  });
}
