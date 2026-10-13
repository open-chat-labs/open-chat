// Logic for EmojiPicker.svelte — carried over from lib/EmojiPicker.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Reaction emoji picker: search + grouped grid (no GIFs). The host owns the surface (popover / menu panel / focus card).
// `selected` marks reactions you've already added (picking one again removes it — host decides). `onBack` shows a back arrow.
// Keys: arrows move in the grid, Enter picks, Esc → onBack (or onClose).
const EMOJI = [
  { label: "FREQUENTLY USED", items: [["😂","joy"],["❤️","heart"],["👍","thumbs up"],["🔥","fire"],["🙏","pray"],["😍","heart eyes"],["🎉","party"],["😅","sweat smile"]] },
  { label: "SMILEYS", items: [["😀","grin"],["😃","smiley"],["😄","smile"],["😁","beaming"],["😆","laughing"],["🥹","holding back tears"],["😊","blush"],["😇","innocent"],["🙂","slight smile"],["😉","wink"],["😌","relieved"],["😋","yum"],["😎","cool"],["🤩","star struck"],["🥳","partying"],["😏","smirk"],["😮","open mouth"],["😢","cry"],["😭","sob"],["😤","triumph"],["😡","rage"],["🤯","mind blown"],["🫡","salute"],["🤔","thinking"]] },
  { label: "PEOPLE", items: [["👋","wave"],["👏","clap"],["🙌","raised hands"],["🤝","handshake"],["💪","muscle"],["👀","eyes"],["✌️","victory"],["🤞","fingers crossed"]] },
  { label: "OBJECTS", items: [["🚀","rocket"],["💎","gem"],["🪙","coin"],["📈","chart up"],["🏆","trophy"],["🎁","gift"],["💡","idea"],["✅","check"]] },
];
class Component extends DCLogic {
  state = { query: "" };
  searchRef = React.createRef(); gridRef = React.createRef();
  componentDidMount() { if (this.props.autoFocus ?? true) requestAnimationFrame(() => this.searchRef.current && this.searchRef.current.focus({ preventScroll: true })); }
  renderVals() {
    const p = this.props, q = this.state.query.trim().toLowerCase(), sel = p.selected || [];
    const recent = (p.recent || []).length ? [{ label: "RECENT", items: p.recent.map(c => [c, (EMOJI.flatMap(g => g.items).find(x => x[0] === c) || [c, c])[1]]) }] : [];
    const src = recent.concat(EMOJI.filter(g => !recent.length || g.label !== "FREQUENTLY USED"));
    const groups = src.map(g => ({ label: g.label, items: g.items.filter(([c, n]) => !q || n.indexOf(q) >= 0).map(([c, n]) => {
      const on = sel.indexOf(c) >= 0;
      return { char: c, name: n, pressedStr: String(on), bg: on ? "var(--accent-soft,rgba(255,86,114,.16))" : "transparent", ring: on ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 50%,transparent)" : "none", pick: () => p.onPick && p.onPick(c) };
    }) })).filter(g => g.items.length);
    return {
      searchRef: this.searchRef, gridRef: this.gridRef, groups, none: !groups.length, query: this.state.query,
      onQuery: e => this.setState({ query: e.target.value }),
      hasBack: !!p.onBack, back: () => p.onBack && p.onBack(),
      onKey: e => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); (p.onBack || p.onClose || (() => {}))(); return; }
        const cells = this.gridRef.current ? [...this.gridRef.current.querySelectorAll("[data-emoji]")] : [];
        const i = cells.indexOf(document.activeElement);
        if (e.target === this.searchRef.current) { if (e.key === "ArrowDown" && cells[0]) { e.preventDefault(); cells[0].focus(); } else if (e.key === "Enter" && cells[0]) { e.preventDefault(); cells[0].click(); } return; }
        if (i < 0) return;
        const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[e.key];
        if (d) { e.preventDefault(); const n = i + d; if (n < 0) this.searchRef.current.focus(); else if (cells[n]) cells[n].focus(); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cells[i].click(); }
      },
    };
  }
}

export default Component;
