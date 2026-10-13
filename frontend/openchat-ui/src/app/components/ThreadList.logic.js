// Logic for ThreadList.svelte — carried over from lib/ThreadList.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// All threads you've replied in or follow, grouped by conversation (chats) or by channel (a community).
class Component extends DCLogic {
  state = { filter: 0 };
  renderVals() {
    const p = this.props, s = this.state;
    const groups = p.groups || [];
    const unreadOnly = s.filter === 1;
    const shown = groups.map(g => {
      const threads = (unreadOnly ? g.threads.filter(t => t.unread) : g.threads).map(t => Object.assign({}, t, {
        bg: t.selected ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent",
        unreadLabel: t.unread ? t.unread + " new" : "",
      }));
      return Object.assign({}, g, { threads, count: String(threads.length) });
    }).filter(g => g.threads.length > 0);
    const unreadN = groups.reduce((n, g) => n + g.threads.filter(t => t.unread).length, 0);
    return {
      // same box as ChatListHeader for the scope: 54px plain, 62px with the community avatar
      headerH: this.props.headerHeight ?? "54px",
      scopeLabel: p.scopeLabel ?? "Groups and direct chats",
      filterTabs: ["All", "Unread"], filterCounts: [null, unreadN || null], filterIndex: s.filter,
      onFilter: i => this.setState({ filter: i }),
      shown, isEmpty: shown.length === 0,
      emptyLabel: unreadOnly ? "You're all caught up." : "No threads yet. Reply to a message to start one.",
      onBack: () => { if (p.onBack) p.onBack(); },
    };
  }
}

export default Component;
