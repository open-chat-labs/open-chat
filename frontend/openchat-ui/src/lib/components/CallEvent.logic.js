// Logic for CallEvent.svelte — carried over from lib/CallEvent.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Call as a centred timeline pill (not a bubble). Single: live (green tint, pulse, Join) | ended | missed (red tint, Call back).
// Grouped: pass `calls` (2+ ended/missed calls in a row) for one collapsible summary pill. Live calls are never grouped — the app decides runs.
class Component extends DCLogic {
  state = { open: false };
  renderVals() {
    const p = this.props;
    const M = m => (m === "voice" ? "var(--icon-phone)" : "var(--icon-video)") + " center/contain no-repeat";
    const word = m => m === "voice" ? "voice" : "video";
    const DANGER = "var(--status-danger,#FF4D4D)", INK = "var(--ink,#ECECF1)", INK2 = "var(--ink-2,#C9C9D4)";
    const calls = Array.isArray(p.calls) ? p.calls : [];
    if (calls.length > 1) {
      const missedN = calls.filter(c => c.state === "missed").length;
      const last = calls[calls.length - 1];
      const title = calls.length + " calls" + (missedN ? " · " + missedN + " missed" : "");
      return {
        single: false, grouped: true, title, aria: title,
        sub: (calls[0].time ?? "") + " – " + (last.time ?? ""),
        iconMask: missedN ? M("voice") : M(last.media),
        iconBg: missedN ? "var(--status-danger-soft,rgba(255,77,77,.12))" : "var(--overlay-2,rgba(255,255,255,.08))",
        iconInk: missedN ? DANGER : INK2,
        rows: calls.map(c => {
          const missed = c.state === "missed", who = c.startedBy ?? "";
          return { mask: M(c.media), ink: missed ? DANGER : INK2, titleInk: missed ? DANGER : INK, time: c.time ?? "",
            title: missed ? "Missed " + word(c.media) + " call" + (who && who !== "You" ? " from " + who : "") : (who === "You" ? "You started a " : "") + (who === "You" ? word(c.media) + " call" : word(c.media)[0].toUpperCase() + word(c.media).slice(1) + " call") + (c.duration ? " · " + c.duration : "") };
        }),
        anyMissed: missedN > 0, callBack: p.onCallBack,
        open: this.state.open, openStr: String(this.state.open), chevron: this.state.open ? "rotate(180deg)" : "none",
        toggle: () => this.setState(s => ({ open: !s.open })),
      };
    }
    const one = calls[0] || {};
    const st = one.state ?? p.state ?? "live", media = one.media ?? p.media ?? "video";
    const live = st === "live", missed = st === "missed", joined = live && !!p.joined;
    const who = one.startedBy ?? p.startedBy ?? "Priya";
    const title = live ? (who === "You" ? "You" : who) + " started a " + word(media) + " call" : missed ? "Missed " + word(media) + " call" + (who !== "You" ? " from " + who : "") : word(media)[0].toUpperCase() + word(media).slice(1) + " call ended";
    const f = (p.faces ?? []).map(x => /^(https?:|data:|\/|\.)/.test(x) ? "center/cover no-repeat url(" + JSON.stringify(x) + ")" : x);
    const over = f.length > 4, hasAction = live || missed;
    return {
      single: true, grouped: false, live, notLive: !live, pulseTile: live, pulseMask: ((p.media ?? "video") === "video" ? "var(--icon-video)" : "var(--icon-phone)") + " center/contain no-repeat",
      title, aria: title,
      sub: live ? "Live · " + (p.elapsed ?? "12:04") + (joined ? " · You're in" : "") : missed ? (one.time ?? p.time ?? "") : (one.duration ?? p.duration ?? "") + " · " + (one.time ?? p.time ?? ""),
      subInk: live ? "var(--status-online,#2EE6A8)" : "var(--ink-4,#8A8A99)",
      titleInk: missed ? DANGER : INK,
      pillBg: live ? "color-mix(in oklch,var(--status-online,#2EE6A8) 10%,var(--surface-2,#191921))" : missed ? "color-mix(in oklch,var(--status-danger,#FF4D4D) 8%,var(--surface-2,#191921))" : "var(--surface-2,#191921)",
      pillRing: live ? "inset 0 0 0 1.5px color-mix(in oklch,var(--status-online,#2EE6A8) 45%,transparent)" : missed ? "inset 0 0 0 1px color-mix(in oklch,var(--status-danger,#FF4D4D) 30%,transparent)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
      iconMask: M(media),
      iconBg: missed ? "var(--status-danger-soft,rgba(255,77,77,.12))" : "var(--overlay-2,rgba(255,255,255,.08))",
      iconInk: missed ? DANGER : INK2,
      stackPeople: f, faces: over ? f.slice(0, 3) : f, hasFaces: live && f.length > 0, hasMore: over, more: over ? "+" + (f.length - 3) : "",
      hasAction, padR: hasAction ? "12px" : "22px",
      action: joined ? "Leave" : live ? "Join" : "Call back", btnMask: live ? M(media) : M("voice"),
      btnBg: joined ? "var(--status-danger,#FF4D4D)" : live ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.1))", btnInk: joined ? "#fff" : live ? "var(--on-accent,#2E0512)" : INK,
      act: joined ? p.onLeave : live ? p.onJoin : p.onCallBack,
    };
  }
}

export default Component;
