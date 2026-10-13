// Logic for ActivityPanel.svelte — carried over from lib/ActivityPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const TABS = ["All", "Mentions", "Payments"];

const FIXTURE = [
  { day: "Today", title: "Bob and two others reacted to your message", context: "The Awesome Group", preview: "You / The illustration slot is in — take a look at the spacing on mobile", time: "44 min", unread: true, color: "teal", kind: "group", reactions: ["😎", "👍", "🙏", "+2"], type: "reaction", chat: "The Awesome Group" },
  { day: "Today", title: "Marcus mentioned you", context: "Design Guild", preview: "Marcus / @you can we get the audit numbers into the deck?", time: "2 h", unread: true, color: "violet", kind: "group", type: "mention", chat: "Design Guild" },
  { day: "Yesterday", title: "Danielle quote replied", context: "Private chat", preview: "Danielle / Agreed — let's ship the shorter version", time: "1 d", unread: false, color: "blue", kind: "user", type: "reply", chat: "Danielle Moreau" },
  { day: "Monday", title: "Priya sent 150 CHAT", context: "Release Train", preview: "Priya / for the release notes, thanks again", time: "3 d", unread: false, color: "teal", kind: "group", type: "payment", chat: "Release Train" },
  { day: "Monday", title: "Robert reacted to your message", context: "Private chat", preview: "You / Okay mate, that sounds good", time: "3 d", unread: false, color: "amber", kind: "user", reactions: ["😎", "👍"], type: "reaction", chat: "Robert Kim" },
  { day: "Friday 14th Nov 2025", title: "Marcus sent 10 USDT", context: "Private chat", preview: "Marcus / covering the audit tooling", time: "1 w", unread: false, color: "blue", kind: "user", type: "payment", chat: "Marcus Webb" },
];

class Component extends DCLogic {
  state = { tab: null, read: [] };

  renderVals() { const __v = this._vals(); __v.loading = !!this.props.loading; __v.loadedOr = { feed: __v.loading ? [] : __v.feed }; return __v; }
  _vals() {
    const items = this.props.items ?? FIXTURE;
    const tab = this.state.tab ?? 0;
    const read = this.state.read;
    const isUnread = it => !!it.unread && read.indexOf(it.title) === -1;

    const matches = it => tab === 0
      || (tab === 1 && it.type === "mention")
      || (tab === 2 && it.type === "payment");

    const shown = items.filter(matches);
    const feed = [];
    let day = null;
    shown.forEach(it => {
      if (it.day !== day) {
        const firstDay = day === null;
        day = it.day;
        feed.push({ isDay: true, isItem: false, day, topPad: firstDay ? "var(--space-8)" : "var(--space-26)" });
      }
      feed.push({
        isDay: false,
        isItem: true,
        title: it.title,
        context: it.context,
        preview: it.preview ?? "",
        time: it.time,
        unread: isUnread(it),
        color: it.color ?? "violet",
        kind: it.kind ?? "user",
        reactions: it.reactions ?? [],
        // every row lands on the message in its chat, payments included
        onPress: () => {
          this.setState(st => ({ read: st.read.indexOf(it.title) === -1 ? st.read.concat([it.title]) : st.read }));
          if (this.props.onOpen) this.props.onOpen(it.chat, it);
        },
      });
    });

    const unreadCount = items.filter(isUnread).length;
    return {
      tabLabels: TABS,
      tabCounts: [items.length, items.filter(i => i.type === "mention").length, items.filter(i => i.type === "payment").length],
      tab,
      onTab: i => this.setState({ tab: i }),
      feed,
      isEmpty: shown.length === 0,
      emptyTitle: tab === 1 ? "No mentions" : "No payments",
      emptyBody: tab === 1
        ? "When someone @mentions you, it shows up here."
        : "Tokens sent to you in a chat show up here.",
      hasUnread: unreadCount > 0,
      onMarkAll: () => this.setState({ read: items.map(i => i.title) }),
    };
  }
}

export default Component;
