// Logic for ExploreCommunities.svelte — carried over from lib/ExploreCommunities.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  search: "var(--icon-search) center/contain no-repeat",
  close: "var(--icon-close) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
  back: "var(--icon-back) center/contain no-repeat",
  users: "var(--icon-users) center/contain no-repeat",
  hash: "var(--icon-hash) center/contain no-repeat",
  eye: "var(--icon-eye) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
  gate: "var(--icon-gate) center/contain no-repeat",
  verified: "var(--icon-verified) center/contain no-repeat",
};
const GRAD = {
  sunset: "linear-gradient(140deg,#FFB03D,#FF5672)", amber: "linear-gradient(140deg,#FFC061,#F58A2E)", blue: "linear-gradient(140deg,#5CB8FF,#2F6BFF)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FA6B8)", plum: "linear-gradient(140deg,#E27BFF,#9B3FD9)", violet: "linear-gradient(140deg,#8B7BFF,#5B3FD9)", rose: "linear-gradient(140deg,#FF8FA8,#E0456A)",
};
const COVER = {
  sunset: "linear-gradient(120deg,#3a1d14,#5a2230 60%,#3b1a2a)", amber: "linear-gradient(120deg,#3a2410,#5a3418)", blue: "linear-gradient(120deg,#11224a,#1f3a72)",
  teal: "linear-gradient(120deg,#0f3330,#16405a)", plum: "linear-gradient(120deg,#2a1838,#52245a)", violet: "linear-gradient(120deg,#1e1a44,#332a70)", rose: "linear-gradient(120deg,#3b1522,#5a1f36)",
};
// rows per page in the table; the real list is paged from the backend
const PAGE = 6;
const fmt = n => n >= 1e6 ? +(n / 1e6).toFixed(1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(1) + "K" : String(n);

class Component extends DCLogic {
  componentDidMount() {
    // the in-menu backdrop only covers this component; clicks anywhere else close it too
    this._away = e => { if (this.state.langOpen && !(e.target.closest && e.target.closest("[data-ex-lang]"))) this.setState({ langOpen: false }); };
    this._esc = e => { if (e.key === "Escape" && this.state.langOpen) this.setState({ langOpen: false }); };
    document.addEventListener("pointerdown", this._away, true);
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() {
    document.removeEventListener("pointerdown", this._away, true);
    document.removeEventListener("keydown", this._esc);
  }
  state = { query: "", sort: 0, focus: false, langs: [], langOpen: false, shown: PAGE };
  renderVals() {
    const p = this.props, st = this.state;
    const joined = p.joinedKeys || [];
    const all = (p.communities || []);
    const q = st.query.trim().toLowerCase();
    const langOf = c => c.language || "English";
    let list = all.filter(c => (!st.langs.length || st.langs.indexOf(langOf(c)) >= 0) &&  (!q || (c.name + " " + (c.about || "")).toLowerCase().indexOf(q) >= 0));
    const by = [(a, b) => b.members - a.members, (a, b) => (b.active || 0) - (a.active || 0), (a, b) => (b.created || 0) - (a.created || 0)][st.sort];
    list = list.slice().sort(by);
    const seg = (label, i) => ({ label, bg: st.sort === i ? "var(--overlay-2,rgba(255,255,255,.1))" : "transparent", ink: st.sort === i ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)", pick: () => this.setState({ sort: i, shown: PAGE }) });
    const n = all.length;
    // search ranks name matches above description matches, then by size
    const score = c => (q && c.name.toLowerCase().indexOf(q) >= 0 ? 2 : 0) + (q && c.name.toLowerCase().indexOf(q) === 0 ? 1 : 0);
    const found = q ? list.slice().sort((a, b) => score(b) - score(a) || b.members - a.members) : [];
    const view = c => {
      const isJoined = joined.indexOf(c.key) >= 0, priv = c.visibility === "Private";
      const nCh = c.channelCount ?? (c.channels || []).length;
      return {
        name: c.name, about: c.about || "No description yet.", verified: !!c.verified,
        avatar: GRAD[c.pin] || GRAD[c.color] || GRAD.teal, cover: COVER[c.cover] || COVER[c.pin] || COVER.plum,
        members: fmt(c.members), channels: String(nCh),
        meta: fmt(c.members) + " members · " + nCh + " channels · " + (c.language || "English"),
        channelList: (c.channels || []).filter(ch => ch.visibility !== "Private").slice(0, 5).map(ch => "# " + ch.title).join("   "),
        canPreview: isJoined || !priv, inviteOnly: !isJoined && priv,
        cta: isJoined ? "Open community" : "Preview community",
        ctaHint: isJoined ? "You’re a member" : c.gate ? "Joining has " + c.gate.items.length + " requirements. Preview first, then check them" : "Read the public channels first, then decide whether to join",
        cardCta: isJoined ? "Open →" : priv ? "Invite only" : "Preview →",
        ctaInk: priv && !isJoined ? "var(--ink-4,#7C7C8C)" : "var(--accent,#FF5672)",
        hasTag: isJoined || priv || !!c.gate, tag: isJoined ? "Joined" : priv ? "Invite only" : "Gated",
        tagBg: isJoined ? "color-mix(in oklch,var(--status-online,#2EE6A8) 14%,transparent)" : "var(--overlay-2,rgba(255,255,255,.07))",
        tagInk: isJoined ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#9A9AA8)",
        tagMask: isJoined ? M.check : priv ? M.lock : M.gate,
        cursor: priv && !isJoined ? "default" : "pointer",
        open: () => { if (p.onOpen && (isJoined || !priv)) p.onOpen(c.key); },
      };
    };
    const cards = found.map(view);
    return { 
      searchMask: M.search, closeMask: M.close, checkMask: M.check, lockMask: M.lock, verifiedMask: M.verified,
      heroSub: n + (n === 1 ? " community" : " communities") + " on OpenChat",
      query: st.query, hasQuery: !!st.query,
      onQuery: e => this.setState({ query: e.target.value }), onClearQuery: () => this.setState({ query: "" }),
      onFocus: () => this.setState({ focus: true }), onBlur: () => this.setState({ focus: false }),
      searchRing: st.focus ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.14))",
      listTitle: st.langs.length ? "Filtered" : "All communities",
      listCount: list.length,
      hasFilter: !!st.langs.length,
      clearFilters: () => this.setState({ langs: [] }),
      chevMask: "var(--icon-chevron-down) center/contain no-repeat",
      langOpen: st.langOpen,
      toggleLang: () => this.setState(x => ({ langOpen: !x.langOpen })),
      closeLang: () => this.setState({ langOpen: false }),
      langBtnLabel: !st.langs.length ? "Any language" : st.langs.length === 1 ? st.langs[0] : st.langs.length + " languages",
      langBtnBg: st.langs.length ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "transparent",
      langBtnLine: st.langs.length ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.1))",
      langBtnInk: st.langs.length ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
      langOptions: Array.from(new Set(all.map(langOf))).sort((a, b) => all.filter(c => langOf(c) === b).length - all.filter(c => langOf(c) === a).length).map(l => {
        const on = st.langs.indexOf(l) >= 0;
        return { label: l, count: all.filter(c => langOf(c) === l).length,
          boxBg: on ? "var(--accent,#FF5672)" : "transparent", boxLine: on ? "var(--accent,#FF5672)" : "var(--line-3,rgba(255,255,255,.22))", checkOpacity: on ? 1 : 0,
          toggle: () => this.setState(x => ({ shown: PAGE, langs: on ? x.langs.filter(k => k !== l) : x.langs.concat([l]) })) };
      }),
      sorts: [seg("Most members", 0), seg("Most active", 1), seg("Newest", 2)],
      isSearching: !!q, notSearching: !q,
      backMask: M.back, eyeMask: M.eye, usersMask: M.users, hashMask: M.hash,
      resultCountLabel: found.length === 1 ? "1 result" : found.length + " results",
      hasBest: cards.length > 0, best: cards[0] || view({ name: "", members: 0 }),
      hasRest: cards.length > 1, restCards: cards.slice(1),
      empty: !!q && found.length === 0,
      listEmpty: list.length === 0,
      get _top() { return q ? [] : list.filter(c => joined.indexOf(c.key) < 0 && c.visibility !== "Private").sort((a, b) => b.members - a.members).slice(0, 4).map(view); },
      get featured() { return this._top[0] || view({ name: "", members: 0 }); },
      get hasFeatured() { return this._top.length > 0; },
      get popular() { return this._top.slice(1); },
      get hasPopular() { return this._top.length > 0; },
      popularTitle: st.langs.length === 1 ? "Popular in " + st.langs[0] : "Popular on OpenChat",
      popularSub: "By members · communities you haven’t joined",
      emptyTitle: q ? "No communities match “" + st.query + "”" : "No communities in these languages yet",
      hasMore: list.length > st.shown,
      loadMoreLabel: "Load " + Math.min(PAGE, list.length - st.shown) + " more",
      shownLabel: "Showing " + Math.min(st.shown, list.length) + " of " + list.length,
      onLoadMore: () => this.setState(x => ({ shown: x.shown + PAGE })),
      rows: list.slice(0, st.shown).map(c => {
        const isJoined = joined.indexOf(c.key) >= 0, priv = c.visibility === "Private";
        return {
          name: c.name, about: c.about || "No description yet.",
          avatar: GRAD[c.pin] || GRAD[c.color] || GRAD.teal,
          members: fmt(c.members), channels: String(c.channelCount ?? (c.channels || []).length),
          lang: c.language || "English",
          isPrivate: priv, verified: !!c.verified,
          joined: isJoined, inviteOnly: !isJoined && priv, canJoin: !isJoined && !priv,
          cursor: !isJoined && priv ? "default" : "pointer",
          open: () => { if (p.onOpen && (isJoined || !priv)) p.onOpen(c.key); },
          join: e => { if (e && e.stopPropagation) e.stopPropagation(); if (p.onJoin) p.onJoin(c.key); },
        };
      }),
      onCreate: p.onCreate,
      isGuest: !!p.guest,
      onSignIn: p.onSignIn,
      onCreateAccount: p.onCreateAccount || p.onSignIn,
    };
  }
}

export default Component;
