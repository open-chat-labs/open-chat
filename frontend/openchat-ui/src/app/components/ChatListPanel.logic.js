// Logic for ChatListPanel.svelte — carried over from lib/ChatListPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const DEFAULT_ROWS = [
  { title: "Danielle Moreau", section: "Pinned", preview: "Pushed the updated flow", time: "10:42", unreadCount: 3, color: "violet", online: true, verified: false, selected: true },
  { title: "The Awesome Group", kind: "group", section: "Pinned", preview: "Priya: see you at 4", time: "09:18", unreadCount: 0, color: "teal", online: true, verified: true, selected: false },
  { title: "Marcus Webb", preview: "Okay mate, that sounds good", time: "Yest", unreadCount: 0, color: "amber", online: false, verified: false, selected: false },
];

const SECTION_ORDER = ["", "Pinned", "Recent"];
const FILTER_LABELS = ["All", "Direct", "Groups", "Unread"];
const DOTS_LAST = [FILTER_LABELS.length - 1];
const DOTS_NONE = [];

class Component extends DCLogic {
  state = { filter: null, query: "" };

  _onFilter = i => { if (i !== (this.state.filter ?? (this.props.selectedFilter ?? 0))) this.setState({ filter: i }); };

  renderVals() { const __v = this._vals(); __v.loading = !!this.props.loading; __v.loadedOr = { groups: __v.loading ? [] : __v.groups }; return __v; }
  _vals() {
    const onSelect = this.props.onSelect;
    const filterLabels = this.props.filterLabels ?? FILTER_LABELS;
    const filterIndex = this.state.filter ?? (this.props.selectedFilter ?? 0);
    const filterKey = (filterLabels[filterIndex] ?? "All").toLowerCase();
    const allRows = (this.props.rows ?? DEFAULT_ROWS).map(r => ({
      ...r,
      kind: r.kind ?? "user",
      pinned: r.pinned ?? r.section === "Pinned",
      onSelect: onSelect ? () => onSelect(r.title) : undefined,
    }));
    const q = this.props.searchable ? this.state.query.trim().toLowerCase() : "";
    const rows = allRows.filter(r => !q || String(r.title).toLowerCase().indexOf(q) >= 0).filter(r =>
      filterKey === "direct" ? r.kind === "user"
      : filterKey === "groups" ? r.kind !== "user"
      : filterKey === "unread" ? (r.unreadCount ?? 0) > 0
      : true);
    const unreadTotal = allRows.filter(r => (r.unreadCount ?? 0) > 0).length;
    const showLabels = this.props.showLabels ?? true;
    const order = [];
    rows.forEach(r => {
      const key = showLabels ? (r.section ?? "Recent") : "";
      let g = order.find(o => o.label === key);
      if (!g) { g = { label: key, rows: [] }; order.push(g); }
      g.rows.push(r);
    });
    // section position is fixed, never inherited from row order — a newly created
    // group landing first must not hoist its section above Pinned
    const rank = label => {
      const i = SECTION_ORDER.indexOf(label);
      return i === -1 ? SECTION_ORDER.length : i;
    };
    order.sort((a, b) => rank(a.label) - rank(b.label));
    const groups = order.map((g, i) => ({
      label: (g.label || "").toUpperCase(),
      hasLabel: !!g.label,
      count: String(g.rows.length),
      rows: g.rows,
      spacer: i === 0 ? "0px" : "var(--space-16)",
    }));
    return {
      rows,
      groups,
      hasRows: rows.length > 0,
      isEmpty: rows.length === 0,
      emptyPreset: rows.length === 0 && allRows.length > 0 ? "no-results" : (this.props.emptyPreset ?? "no-conversations"),
      filterLabels,
      filterIndex,
      filterDots: unreadTotal > 0 ? DOTS_LAST : DOTS_NONE,
      onFilter: this._onFilter,
      showTabs: this.props.showTabs ?? true,
      query: this.state.query,
      onQuery: this.props.searchable ? (e => this.setState({ query: e.target.value })) : undefined,
      clearQuery: () => this.setState({ query: "" }),
      onHeaderMenu: this.props.onHeaderMenu,
      headerMenuItems: this.props.headerMenuItems,
      onHeaderDetails: this.props.onHeaderDetails,
      searchPlaceholder: this.props.searchPlaceholder ?? "Search conversations",
      onGroupCreated: this.props.onGroupCreated,
      onCreateGroup: this.props.onCreateGroup,
      isDiamond: this.props.isDiamond ?? true,
      showHeader: !!this.props.headerKind,
      headerKind: this.props.headerKind ?? "dms",
      headerTitle: this.props.headerTitle ?? "Chats",
      headerVisibility: this.props.headerVisibility ?? "Public",
      headerMembers: this.props.headerMembers ?? 248,
      headerColor: this.props.headerColor ?? "teal",
      showThreads: (this.props.showThreads ?? true) && rows.length > 0,
      threadCount: String(this.props.threadCount ?? 2),
      hasThreadCount: (this.props.threadCount ?? 2) > 0,
      threadsAction: this.props.threadsAction,
      threadsMask: "var(--icon-threads) center/contain no-repeat",
    };
  }
}

export default Component;
