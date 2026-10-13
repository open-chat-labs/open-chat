// Logic for AchievementsDialog.svelte — carried over from lib/AchievementsDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const BACK = "var(--icon-back) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const CHAT = "var(--icon-chat) center/contain no-repeat";
const USER = "var(--icon-user) center/contain no-repeat";
const USERS = "var(--icon-users) center/contain no-repeat";
const WALLET = "var(--icon-wallet) center/contain no-repeat";
const FLAME = "var(--icon-flame) center/contain no-repeat";
const LINK = "var(--icon-link) center/contain no-repeat";
const COIN = "var(--icon-coin) center/contain no-repeat";
const GIFT = "var(--icon-gift) center/contain no-repeat";
const IMAGE = "var(--icon-image) center/contain no-repeat";

// [label, done, reward, band] — band tags what the "next up" trio draws from
const GROUPS = [
  { key: "messaging", label: "Messaging", mask: CHAT, ink: "var(--status-chit,#FF9F45)", items: [
    ["Tip a message", false, 1000, "mid", COIN],
    ["Send a prize message", false, 1000, "mid", GIFT],
    ["Receive a message tip", false, 1000, "mid", COIN],
    ["Send a meme message", false, 500, "quick", IMAGE],
    ["Follow a thread", false, 500, "quick", CHAT],
    ["Send a text message", true, 500], ["React to a message", true, 500],
    ["Send a direct message", true, 500], ["Receive a direct message", true, 500],
    ["Edit a message", true, 500], ["Delete a message", true, 500],
    ["Forward a message", true, 500], ["Send an image", false, 500, "quick", IMAGE],
    ["Send a file", true, 500], ["Send a poll", true, 500],
    ["Send a crypto message", true, 1000], ["Receive a crypto message", true, 1000],
    ["Send a video", true, 500], ["Send an audio message", true, 500],
    ["Send an animated gif", true, 500], ["Quote reply to a message", true, 500],
    ["Start a reply in a thread", true, 500], ["Send a reminder", true, 500],
    ["Receive a reaction on a message", true, 500], ["Vote on a poll", true, 500],
  ] },
  { key: "profile", label: "Profile & membership", mask: USER, ink: "var(--accent,#FF5672)", items: [
    ["Update your profile bio", false, 500, "quick", USER],
    ["Upload your profile avatar", true, 500], ["Update your display name", true, 500],
    ["Upgrade to Diamond membership", true, 5000], ["Upgrade to Lifetime Diamond membership", true, 20000],
  ] },
  { key: "wallet", label: "Wallet & swaps", mask: WALLET, ink: "var(--status-verified,#3D9BFF)", items: [
    ["Accept a swap offer", false, 2000, "mid", WALLET],
    ["Set a pin number on your wallet", true, 500], ["Swap a token from the wallet", true, 1000],
    ["Send a P2P swap offer", true, 1000],
  ] },
  { key: "community", label: "Community & chats", mask: USERS, ink: "var(--status-online,#2EE6A8)", items: [
    ["Join a community", true, 500], ["Join a group", true, 500], ["Join a call", true, 500],
    ["Mark a chat as a favourite", true, 500], ["Pin a chat to the top of the list", true, 500],
    ["Set a community display name", true, 500],
  ] },
  { key: "streaks", label: "Streaks", mask: FLAME, ink: "var(--status-chit,#FF9F45)", items: [
    ["Achieve a 3 day streak", true, 500], ["Achieve a 7 day streak", true, 1000],
    ["Achieve a 14 day streak", true, 2000], ["Achieve a 30 day streak", true, 5000],
    ["Achieve a 100 day streak", true, 10000], ["Achieve a 365 day streak", true, 25000],
  ] },
  { key: "referrals", label: "Referrals", mask: USERS, ink: "var(--ink-3,#9A9AA8)", items: [
    ["Refer your 1st verified user", false, 5000, "big", USERS],
    ["Refer your 3rd verified user", false, 7500, "big", USERS],
    ["Refer your 10th verified user", false, 10000, "big", USERS],
    ["Refer your 20th verified user", false, 15000],
    ["Refer your 50th verified user", false, 25000],
  ] },
  { key: "partners", label: "From partners", mask: LINK, ink: "var(--ink-4,#7C7C8C)", items: [] },
];

const fmt = n => n.toLocaleString("en-US");
const CARD_STYLES = [
  { ink: "var(--accent,#FF5672)", bg: "var(--accent-soft,rgba(255,86,114,.12))", ring: "inset 0 0 0 1px var(--accent,#FF5672)" },
  { ink: "var(--status-chit,#FF9F45)", bg: "var(--overlay-1,rgba(255,255,255,.045))", ring: "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" },
  { ink: "var(--status-online,#2EE6A8)", bg: "var(--overlay-1,rgba(255,255,255,.045))", ring: "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" },
];

class Component extends DCLogic {
  // the trio is drawn once per open, so it changes between visits but never
  // shuffles under the reader
  state = { seed: Math.floor(Math.random() * 997), open: undefined };
  componentDidMount() {
    if (!this.props.highlight) return;
    // bring the just-earned row into view inside the dialog's own scroller
    setTimeout(() => {
      const row = document.querySelector('[data-ach-hl="1"]'); if (!row) return;
      let sc = row.parentElement; while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      if (sc) sc.scrollTop += row.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 3;
    }, 120);
  }

  renderVals() {
    const all = [];
    // `unlocked` (labels) marks achievements earned this session as done; `highlight` opens and marks that row
    const unl = this.props.unlocked || [], hl = this.props.highlight || null;
    const isDone = (label, done) => done || unl.indexOf(label) >= 0;
    GROUPS.forEach(g => g.items.forEach(([label, done, reward, band, mask]) => {
      done = isDone(label, done);
      all.push({ group: g.key, label, done, reward, band, mask });
    }));
    const done = all.filter(a => a.done);
    const left = all.filter(a => !a.done);
    const earned = done.reduce((sum, a) => sum + a.reward, 0);
    const onOffer = left.reduce((sum, a) => sum + a.reward, 0);

    // one quick win, one middling task, one referral — so the trio always has
    // something doable today and something worth aiming at
    const pick = (band, salt) => {
      const pool = left.filter(a => a.band === band);
      return pool.length ? pool[(this.state.seed + salt) % pool.length] : null;
    };
    const next = [pick("quick", 0), pick("mid", 1), pick("big", 2)]
      .filter(Boolean)
      .map((a, i) => ({
        label: a.label,
        reward: fmt(a.reward) + " CHIT",
        mask: a.mask ?? CHAT,
        ink: CARD_STYLES[i].ink,
        bg: CARD_STYLES[i].bg,
        ring: CARD_STYLES[i].ring,
      }));

    return {
      closeMask: CLOSE,
      backMask: BACK,
      chevronMask: CHEVRON,
      checkMask: CHECK,

      subtitle: done.length + " of " + all.length + " done · " + fmt(earned) + " CHIT earned · " + fmt(onOffer) + " still on offer",
      hasNext: next.length > 0,
      next,

      groups: GROUPS.map(g => {
        const hlHere = !!hl && g.items.some(i => i[0] === hl);
        const open = this.state.open === undefined ? hlHere : this.state.open === g.key;
        const total = g.items.length;
        const gotten = g.items.filter(i => isDone(i[0], i[1])).length;
        // unfinished first: the list should read as work left, then history
        // the just-unlocked row leads; then unfinished first: the list should read as work left, then history
        const rows = g.items.map(i => [i[0], isDone(i[0], i[1]), i[2]]).sort((a, b) => (b[0] === hl) - (a[0] === hl) || (a[1] ? 1 : 0) - (b[1] ? 1 : 0));
        return {
          label: g.label,
          mask: g.mask,
          ink: g.ink,
          count: total ? gotten + " / " + total : "0 / 0",
          pct: total ? Math.round(gotten / total * 100) + "%" : "0%",
          open,
          chevronTurn: open ? "rotate(90deg)" : "none",
          bg: open ? "var(--overlay-1,rgba(255,255,255,.05))" : "var(--overlay-1,rgba(255,255,255,.035))",
          ring: open ? "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" : "none",
          onToggle: () => this.setState({ open: open ? null : g.key }),
          empty: total === 0,
          emptyLine: "Relax! You have nothing left to do. External achievements are set by third parties — when one appears, follow its link to claim the CHIT.",
          rows: rows.map(([label, isDone, reward]) => ({
            label, hl: label === hl ? "1" : "0",
            rowBg: label === hl ? "color-mix(in oklch,var(--accent,#FF5672) 14%,transparent)" : "transparent",
            rowRing: label === hl ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 40%,transparent)" : "none",
            reward: label === hl ? "Just earned · +" + fmt(reward) : isDone ? "Earned" : fmt(reward) + " CHIT",
            markBg: isDone ? "color-mix(in srgb, var(--status-online,#2EE6A8) 16%, transparent)" : "transparent",
            markRing: isDone ? "none" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.24))",
            markOpacity: isDone ? "1" : "0",
            labelInk: isDone ? "var(--ink-3,#9A9AA8)" : "var(--ink,#ECECF1)",
            rewardInk: label === hl ? "var(--accent-bright,#FF8298)" : isDone ? "var(--ink-4,#7C7C8C)" : "var(--status-chit,#FF9F45)",
          })),
        };
      }),

      onBack: () => { if (this.props.onBack) this.props.onBack(); else if (this.props.onClose) this.props.onClose(); },
      onClose: () => { if (this.props.onClose) this.props.onClose(); },
      veilAnim: "oc-veil-in var(--duration-base,200ms) var(--ease-out) both",
      cardAnim: "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both",
    };
  }
}

export default Component;
