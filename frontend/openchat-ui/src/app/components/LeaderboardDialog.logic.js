// Logic for LeaderboardDialog.svelte — carried over from lib/LeaderboardDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const BACK = "var(--icon-back) center/contain no-repeat";
const JOYSTICK = "var(--icon-joystick) center/contain no-repeat";

// three boards, as the current web version has: two months and all time
const BOARDS = {
  august: {
    label: "AUGUST",
    rows: [
      ["SKYE_TERRIER", 64200], ["AKMANNURIYE", 61500], ["KEYTAATGLU", 52800],
      ["ZARINAZARI", 44100], ["KAY", 38900], ["HAFSAT001", 33200],
      ["0XCLD", 31800], ["VA867", 29400], ["PIKO_NETWORK", 25600], ["BRITTANY91", 24900],
    ],
    you: { rank: 312, score: 17800 },
  },
  september: {
    label: "SEPTEMBER",
    rows: [
      ["AKMANNURIYE", 70800], ["SKYE_TERRIER", 70800], ["ZARINAZARI", 70600],
      ["KEYTAATGLU", 38400], ["HAFSAT001", 37000], ["KAY", 36800],
      ["VA867", 36000], ["0XCLD", 34600], ["BRITTANY91", 31500], ["PIKO_NETWORK", 27700],
    ],
    you: { rank: 245, score: 21400 },
  },
  all: {
    label: "ALL TIME",
    rows: [
      ["AKMANNURIYE", 3853800], ["SKYE_TERRIER", 3577200], ["KEYTAATGLU", 2894400],
      ["ZARINAZARI", 2706900], ["KAY", 2344500], ["0XCLD", 2117700],
      ["HAFSAT001", 2064600], ["VA867", 1838100], ["BRITTANY91", 1678200], ["PIKO_NETWORK", 1494300],
    ],
    you: { rank: 188, score: 539400 },
  },
};

const ORDER = ["august", "september", "all"];

class Component extends DCLogic {
  state = { period: "september" };

  renderVals() {
    const key = this.state.period;
    const board = BOARDS[key];
    const supplied = this.props.you ?? null;
    let you = (supplied && (supplied[key] ?? (supplied.rank !== undefined ? supplied : null))) ?? board.you;
    // never claim a rank the board itself contradicts
    const beaten = board.rows.filter(r => r[1] <= you.score).length;
    if (beaten > 0) you = { rank: board.rows.length - beaten + 1, score: you.score };

    return {
      closeMask: CLOSE,
      backMask: BACK,
      joystickMask: JOYSTICK,

      periods: ORDER.map(k => ({
        label: BOARDS[k].label,
        ink: k === key ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)",
        rule: k === key ? "var(--status-chit,#FF9F45)" : "transparent",
        onSelect: () => this.setState({ period: k }),
      })),

      rows: board.rows.map(([handle, score], i) => ({
        rank: String(i + 1),
        handle,
        score: String(score),
        // the podium lights up green, the chasing pack stays white
        ink: i < 3 ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)",
      })),

      youRank: String(you.rank),
      youHandle: "YOU — " + (this.props.handle ?? "JAMES_SMITH"),
      youScore: String(you.score),

      onBack: () => { if (this.props.onBack) this.props.onBack(); else if (this.props.onClose) this.props.onClose(); },
      onClose: () => { if (this.props.onClose) this.props.onClose(); },
      veilAnim: "oc-veil-in var(--duration-base,200ms) var(--ease-out) both",
      cardAnim: "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both",
    };
  }
}

export default Component;
