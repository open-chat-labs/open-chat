// Logic for DailyPuzzleCard.svelte — carried over from lib/DailyPuzzleCard.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Daily puzzle entry (opt-in). state: new | progress | solved | hidden (one-line "hidden" + Undo) | off (renders nothing).
// "⋯" menu: Remind me daily / How to play / Hide. Everything reports through onAction(key):
// puzzle | puzzleRemindOn | puzzleRemindOff | puzzleHow | puzzleHide | puzzleUnhide.
class Component extends DCLogic {
  state = { pzMenu: false };
  _puzzle() {
    const p = this.props, st = this.state, ps = p.state ?? "new", act = k => { if (p.onAction) p.onAction(k); };
    const M = n => "var(--icon-" + n + ") center/contain no-repeat";
    const shown = ps !== "off" && ps !== "hidden";
    const cfg = {
      new: { title: "Today's puzzle · Bridges", sub: "A 5-minute logic puzzle", btn: "Try it", bg: "var(--overlay-2,rgba(255,255,255,.09))", ink: "var(--ink,#ECECF1)", tile: "var(--overlay-2,rgba(255,255,255,.07))", tileInk: "var(--ink-3,#9A9AA8)", mask: M("joystick") },
      progress: { title: "Today's puzzle · Bridges", sub: p.sub ?? "In progress", btn: "Continue", bg: "var(--accent,#FF5672)", ink: "var(--on-accent,#2E0512)", tile: "var(--accent-soft,rgba(255,86,114,.16))", tileInk: "var(--accent-bright,#FF8298)", mask: M("joystick") },
      solved: { title: p.sub ?? "Solved", sub: "Next puzzle in " + (p.countdown ?? "10:10:10"), btn: "View", bg: "var(--overlay-2,rgba(255,255,255,.09))", ink: "var(--ink,#ECECF1)", tile: "color-mix(in oklch,var(--status-online,#2EE6A8) 16%,transparent)", tileInk: "var(--status-online,#2EE6A8)", mask: M("circle-check") },
    }[shown ? ps : "new"];
    const remind = !!p.remind, close = () => this.setState({ pzMenu: false });
    return {
      pzCard: shown, pzHidden: ps === "hidden", pzRemind: remind,
      pzTitle: cfg.title, pzSub: cfg.sub, pzBtn: cfg.btn, pzBtnBg: cfg.bg, pzBtnInk: cfg.ink, pzTileBg: cfg.tile, pzTileInk: cfg.tileInk, pzMask: cfg.mask,
      onPuzzle: () => act("puzzle"),
      pzMenuOpen: st.pzMenu, pzMenuOpenStr: String(st.pzMenu), pzMenuBtnBg: st.pzMenu ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
      togglePzMenu: () => this.setState(s => ({ pzMenu: !s.pzMenu })),
      pzMenu: [
        { label: "Remind me daily", mask: M("bell"), on: remind, press: () => { close(); act(remind ? "puzzleRemindOff" : "puzzleRemindOn"); } },
        { label: "How to play", mask: M("info"), on: false, press: () => { close(); act("puzzleHow"); } },
        { label: "Hide daily puzzle", mask: M("eye-off"), on: false, press: () => { close(); act("puzzleHide"); } },
      ],
      unhidePuzzle: () => act("puzzleUnhide"),
    };
  }  renderVals() { return this._puzzle(); }
}

export default Component;
