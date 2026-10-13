// Logic for UserGroupDialog.svelte — carried over from lib/UserGroupDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const USERS = "var(--icon-users) center/contain no-repeat";
const TRASH = "var(--icon-trash) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const SEARCH = "var(--icon-search) center/contain no-repeat";
const SAVE = "var(--icon-disk) center/contain no-repeat";
const ADD = "var(--icon-invite) center/contain no-repeat";
const PLUS = "var(--icon-plus) center/contain no-repeat";
const GRADIENTS = {
  violet: "linear-gradient(140deg,#8B7BFF,#5B3FD9)", teal: "linear-gradient(140deg,#2EE6A8,#1FA6B8)",
  amber: "linear-gradient(140deg,#FFC061,#F58A2E)", blue: "linear-gradient(140deg,#5CB8FF,#2F6BFF)",
  plum: "linear-gradient(140deg,#E27BFF,#9B3FD9)", rose: "linear-gradient(140deg,#FF8FA8,#E0456A)",
  slate: "linear-gradient(140deg,#8A93A8,#4F586C)",
};
const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";
const slug = n => "@" + String(n).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const g = props.group || {};
    this.state = { closing: false, name: g.title || "", picked: (g.members || []).map(m => m.handle), query: "", focus: false, hi: 0 };
  }
  componentDidMount() {
    this._key = e => { if (e.key === "Escape" && !e.defaultPrevented) this._close(this.props.onCancel); };
    window.addEventListener("keydown", this._key);
  }
  componentWillUnmount() { clearTimeout(this._t); window.removeEventListener("keydown", this._key); }
  _close(fn, arg) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { if (fn) fn(arg); }, 170);
  }
  renderVals() {
    const p = this.props, st = this.state;
    const mode = p.dialogMode ?? "create";
    const isDelete = mode === "delete", isEdit = mode === "edit";
    const g = p.group || {};
    const people = p.people || [];
    const byHandle = h => people.find(x => x.handle === h) || { name: h, handle: h, color: "slate" };
    const q = st.query.trim().toLowerCase();
    const matches = q ? people.filter(x => st.picked.indexOf(x.handle) < 0 && (x.name + " " + x.handle).toLowerCase().indexOf(q) >= 0).slice(0, 8) : [];
    const hi = Math.min(st.hi, Math.max(0, matches.length - 1));
    const add = h => this.setState(s => ({ picked: s.picked.indexOf(h) >= 0 ? s.picked : [h].concat(s.picked), query: "", hi: 0 }));
    const results = matches.map((x, i) => ({
      name: x.name, handle: x.handle, grad: GRADIENTS[x.color] || GRADIENTS.slate,
      bg: i === hi ? "var(--overlay-2,rgba(255,255,255,.07))" : "transparent",
      hintOpacity: i === hi ? 1 : 0,
      add: e => { if (e && e.preventDefault) e.preventDefault(); add(x.handle); },
      hover: () => { if (st.hi !== i) this.setState({ hi: i }); },
    }));
    const dropOpen = st.focus && !!q;
    const name = st.name.trim();
    const taken = (p.takenNames || []).some(n => n.toLowerCase() === name.toLowerCase() && n.toLowerCase() !== String(g.title || "").toLowerCase());
    const ok = isDelete || (name.length > 0 && !taken && st.picked.length > 0);
    const count = (g.members || []).length;
    const communityName = p.communityName ?? "OpenChat";
    return { 
      isDelete, isForm: !isDelete,
      cardWidth: isDelete ? "460px" : "520px",
      cardHeight: isDelete ? "auto" : "680px",
      heading: isDelete ? "Delete user group" : isEdit ? "Edit user group" : "New user group",
      headSub: isEdit || isDelete ? (g.title || "") + " · " + communityName : "in " + communityName,
      headMask: isDelete ? TRASH : USERS,
      headBg: isDelete ? "var(--btn-danger-bg,rgba(240,68,56,.08))" : "var(--overlay-1,rgba(255,255,255,.05))",
      headLine: isDelete ? "var(--btn-danger-line,rgba(240,68,56,.5))" : "var(--line-2,rgba(255,255,255,.1))",
      headInk: isDelete ? "var(--status-danger,#F5493D)" : "var(--ink-2,#B9B9C6)",
      closeMask: CLOSE, checkMask: CHECK, searchMask: SEARCH,
      groupName: g.title || "", communityName, mention: slug(g.title || ""),
      memberCountText: count === 1 ? "1 member" : count + " members",
      name: st.name, onName: e => this.setState({ name: e.target.value }),
      nameRing: taken ? "var(--status-danger,#F5493D)" : st.name ? "var(--line-3,rgba(255,255,255,.22))" : "var(--line-2,rgba(255,255,255,.1))",
      nameHelp: taken ? "A user group with this name already exists." : name ? "Members can mention everyone in it with " + slug(name) : "Members can mention everyone in the group at once.",
      pickedCount: st.picked.length,
      hasPicked: st.picked.length > 0,
      picked: st.picked.map(h => { const x = byHandle(h); return { name: x.name, handle: x.handle, grad: GRADIENTS[x.color] || GRADIENTS.slate, remove: () => this.setState(s => ({ picked: s.picked.filter(k => k !== h) })) }; }),
      noPicked: st.picked.length === 0,
      addMask: ADD,
      query: st.query, onQuery: e => this.setState({ query: e.target.value, hi: 0 }),
      onSearchFocus: () => this.setState({ focus: true }),
      onSearchBlur: () => this.setState({ focus: false }),
      onQueryKey: e => {
        if (e.key === "ArrowDown") { e.preventDefault(); this.setState({ hi: Math.min(hi + 1, matches.length - 1) }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); this.setState({ hi: Math.max(hi - 1, 0) }); }
        else if (e.key === "Enter" && matches[hi]) { e.preventDefault(); add(matches[hi].handle); }
        else if (e.key === "Escape" && st.query) { e.preventDefault(); e.stopPropagation(); this.setState({ query: "" }); }
      },
      searchRing: st.focus ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.1))",
      dropOpen, listOpacity: dropOpen ? 0.55 : 1,
      results, noResults: results.length === 0,
      noResultsText: people.some(x => (x.name + " " + x.handle).toLowerCase().indexOf(q) >= 0) ? "Everyone matching “" + st.query + "” is already in the group" : "No one in " + communityName + " matches “" + st.query + "”",
      cta: isDelete ? "Delete" : isEdit ? "Save changes" : "Create user group",
      ctaMask: isDelete ? TRASH : isEdit ? SAVE : PLUS,
      ctaBg: !ok ? "var(--overlay-2,rgba(255,255,255,.09))" : isDelete ? "var(--status-danger,#F5493D)" : "var(--accent,#FF5672)",
      ctaInk: !ok ? "var(--ink-4,#7C7C8C)" : isDelete ? "#fff" : "var(--on-accent,#2E0512)",
      ctaCursor: ok ? "pointer" : "default",
      onCancel: () => this._close(p.onCancel),
      onConfirm: () => {
        if (!ok) return;
        if (isDelete) this._close(p.onDelete, g.key);
        else this._close(p.onSave, { key: g.key || null, title: name, members: st.picked });
      },
      veilAnim: st.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: st.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;
