// Logic for PuzzleDialog.svelte — carried over from lib/PuzzleDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Bridges (hashi). Islands [x, y, n]; SOL lists [i, j, count] — a valid solution used for hints.
const PUZZLE = { grid: 7,
  isl: [[0,0,3],[3,0,3],[6,0,3],[0,2,4],[2,2,4],[5,2,1],[2,4,3],[4,4,4],[6,4,4],[0,6,3],[4,6,4],[6,6,2]],
  sol: [[0,1,2],[1,2,1],[0,3,1],[2,8,2],[3,4,2],[4,5,1],[4,6,1],[6,7,2],[7,8,1],[7,10,1],[3,9,1],[9,10,2],[10,11,1],[8,11,1]] };
const TUT = { grid: 6, isl: [[1,1,3],[4,1,3],[1,4,2],[4,4,2]], sol: [[0,1,2],[0,2,1],[1,3,1],[2,3,1]] };
const STEPS = [
  { t: "Every number is a target", b: "Each island needs exactly that many bridges. When it has them, it lights up." },
  { t: "Tap two islands to connect", b: "Tap an island, then another in the same row or column. Tap the pair again for a double bridge, a third time to clear it." },
  { t: "Straight, no crossing", b: "Bridges run straight, never cross each other, and at most two join any pair." },
  { t: "Link them all", b: "Everything ends up in one connected group. Finish this little board, then start today's." },
];
const HINT_COST = 100, HINTS = 3;
const pk = (i, j) => i < j ? i + "-" + j : j + "-" + i;
const fmtT = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

function neighbours(isl) {
  return isl.map(([x, y], i) => {
    const out = [];
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
      let best = -1, bd = 1e9;
      isl.forEach(([x2, y2], j) => {
        if (j === i) return;
        const d = dx ? (x2 - x) * dx : (y2 - y) * dy;
        if ((dx ? y2 === y : x2 === x) && d > 0 && d < bd) { bd = d; best = j; }
      });
      if (best >= 0) out.push(best);
    });
    return out;
  });
}
function crossesAny(isl, br, i, j) {
  const [ax, ay] = isl[i], [bx, by] = isl[j], h = ay === by;
  return Object.keys(br).some(k => {
    if (!br[k]) return false;
    const [p, q] = k.split("-").map(Number);
    const [cx, cy] = isl[p], [dx, dy] = isl[q];
    if ((cy === dy) === h) return false;
    if (h) { const vx = cx, y1 = Math.min(cy, dy), y2 = Math.max(cy, dy); return vx > Math.min(ax, bx) && vx < Math.max(ax, bx) && ay > y1 && ay < y2; }
    const hy = cy, x1 = Math.min(cx, dx), x2 = Math.max(cx, dx); return hy > Math.min(ay, by) && hy < Math.max(ay, by) && ax > x1 && ax < x2;
  });
}
function counts(isl, br) {
  const c = isl.map(() => 0);
  Object.keys(br).forEach(k => { const [p, q] = k.split("-").map(Number); c[p] += br[k]; c[q] += br[k]; });
  return c;
}
function isSolved(isl, br) {
  const c = counts(isl, br);
  if (c.some((v, i) => v !== isl[i][2])) return false;
  const adj = isl.map(() => []);
  Object.keys(br).forEach(k => { if (!br[k]) return; const [p, q] = k.split("-").map(Number); adj[p].push(q); adj[q].push(p); });
  const seen = new Set([0]), st = [0];
  while (st.length) adj[st.pop()].forEach(n => { if (!seen.has(n)) { seen.add(n); st.push(n); } });
  return seen.size === isl.length;
}

class Component extends DCLogic {
  constructor(p) {
    super(p);
    const s = p.saved || {};
    this.state = {
      view: p.solved ? "solved" : (p.tutorialSeen ? "play" : "tutorial"),
      step: 0, br: s.br || {}, hist: [], sel: null, err: "", elapsed: s.elapsed || 0, hints: s.hints || 0,
      tbr: {}, tsel: null, terr: "", closing: false, answered: null,
      wide: typeof window !== "undefined" ? window.innerWidth >= 900 : true,
    };
    this.nb = neighbours(PUZZLE.isl); this.tnb = neighbours(TUT.isl);
  }
  componentDidMount() {
    this._tick = setInterval(() => { if (this.state.view === "play" && !this.state.closing) this.setState(s => ({ elapsed: s.elapsed + 1 })); }, 1000);
    this._rs = () => this.setState({ wide: window.innerWidth >= 900 });
    window.addEventListener("resize", this._rs);
  }
  componentWillUnmount() { clearInterval(this._tick); clearTimeout(this._et); clearTimeout(this._t); clearTimeout(this._st); window.removeEventListener("resize", this._rs); this._save(); }
  _save() { const s = this.state; if (this.props.onProgress) this.props.onProgress({ br: s.br, elapsed: s.elapsed, hints: s.hints, done: counts(PUZZLE.isl, s.br).filter((v, i) => v === PUZZLE.isl[i][2]).length, total: PUZZLE.isl.length }); }
  _close() { if (this.state.closing) return; this.setState({ closing: true }); this._t = setTimeout(() => { if (this.props.onClose) this.props.onClose(); }, 170); }
  _flash(key, msg) { clearTimeout(this._et); this.setState({ [key]: msg }); this._et = setTimeout(() => this.setState({ [key]: "" }), 1600); }

  _press(tut, i) {
    const P = tut ? TUT : PUZZLE, nb = tut ? this.tnb : this.nb;
    const selK = tut ? "tsel" : "sel", brK = tut ? "tbr" : "br", errK = tut ? "terr" : "err";
    const st = this.state, sel = st[selK];
    if (sel === null || sel === i) return this.setState({ [selK]: sel === i ? null : i });
    if (!nb[sel].includes(i)) return this.setState({ [selK]: i });
    const k = pk(sel, i), cur = st[brK][k] || 0, next = (cur + 1) % 3;
    if (cur === 0 && crossesAny(P.isl, st[brK], sel, i)) { this.setState({ [selK]: null }); return this._flash(errK, "Bridges can't cross"); }
    const br = { ...st[brK], [k]: next };
    if (!next) delete br[k];
    this._commit(tut, br, { [selK]: null });
  }
  _remove(tut, k) { const br = { ...this.state[tut ? "tbr" : "br"] }; delete br[k]; this._commit(tut, br, {}); }
  _commit(tut, br, extra) {
    if (tut) return this.setState({ tbr: br, ...extra });
    this.setState(s => ({ br, hist: s.hist.concat([s.br]).slice(-50), ...extra }), () => {
      this._save();
      if (isSolved(PUZZLE.isl, br)) {
        this._st = setTimeout(() => {
          this.setState({ view: "solved" });
          if (this.props.onSolved) this.props.onSolved({ elapsed: this.state.elapsed, hints: this.state.hints });
        }, 550);
      }
    });
  }
  _hint() {
    const s = this.state;
    if (s.hints >= HINTS || (this.props.balance ?? 1e9) < HINT_COST) return;
    const target = PUZZLE.sol.find(([i, j, n]) => (s.br[pk(i, j)] || 0) !== n);
    if (!target) return;
    const [i, j, n] = target, br = { ...s.br };
    // drop wrong bridges that would block the hinted one
    Object.keys(br).forEach(k => { const [p, q] = k.split("-").map(Number); const one = {}; one[k] = br[k]; if (crossesAny(PUZZLE.isl, one, i, j) && !PUZZLE.sol.some(([a, b]) => pk(a, b) === k)) delete br[k]; });
    br[pk(i, j)] = n;
    this.setState({ hints: s.hints + 1 });
    if (this.props.onHint) this.props.onHint(HINT_COST);
    this._commit(false, br, { sel: null });
  }

  _board(P, br, sel, err, nb, tut) {
    const g = P.grid, cell = 100 / g, D = cell * 0.66, c = counts(P.isl, br);
    const cand = sel === null ? [] : nb[sel];
    const islands = P.isl.map(([x, y, n], i) => {
      const done = c[i] === n, over = c[i] > n, isSel = sel === i, isCand = cand.includes(i);
      return {
        n, l: ((x + .5) * cell - D / 2) + "%", t: ((y + .5) * cell - D / 2) + "%", d: D + "%",
        aria: "Island " + n + ", " + c[i] + " of " + n + " bridges" + (isSel ? ", selected" : ""),
        bg: done ? "var(--accent,#FF5672)" : "var(--surface-3,#24242e)",
        ink: done ? "var(--on-accent,#2E0512)" : "var(--ink,#ECECF1)",
        ring: over ? "inset 0 0 0 2px var(--status-danger,#FF4D4D)"
          : isSel ? "0 0 0 4px color-mix(in oklch,var(--accent,#FF5672) 45%,transparent),inset 0 0 0 2px var(--accent-bright,#FF8298)"
          : isCand ? "inset 0 0 0 1.5px color-mix(in oklch,var(--accent,#FF5672) 70%,transparent)"
          : done ? "none" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.24))",
        scale: isSel ? "scale(1.06)" : "none",
        press: () => this._press(tut, i),
      };
    });
    const bridges = Object.keys(br).filter(k => br[k]).map(k => {
      const [p, q] = k.split("-").map(Number), [ax, ay] = P.isl[p], [bx, by] = P.isl[q], h = ay === by;
      const x1 = (Math.min(ax, bx) + .5) * cell, x2 = (Math.max(ax, bx) + .5) * cell, y1 = (Math.min(ay, by) + .5) * cell, y2 = (Math.max(ay, by) + .5) * cell;
      const lines = Array.from({ length: br[k] }, () => h ? { w: "100%", h: "3px" } : { w: "3px", h: "100%" });
      const over = [p, q].some(i => c[i] > P.isl[i][2]);
      return { lines, dir: h ? "column" : "row", ink: over ? "var(--status-danger,#FF4D4D)" : "var(--ink-2,#C9C9D4)",
        l: h ? x1 + "%" : "calc(" + x1 + "% - 10px)", t: h ? "calc(" + y1 + "% - 10px)" : y1 + "%",
        w: h ? (x2 - x1) + "%" : "20px", h: h ? "20px" : (y2 - y1) + "%", remove: () => this._remove(tut, k) };
    });
    return { islands, bridges, cell: cell + "%", fs: (g === 7 ? 5.4 : 7.4) + "cqw", err, hasErr: !!err, solved: tut && isSolved(P.isl, br), doneN: islands.filter((_, i) => c[i] === P.isl[i][2]).length };
  }

  renderVals() {
    const s = this.state, p = this.props;
    const pb = this._board(PUZZLE, s.br, s.sel, s.err, this.nb, false);
    const tb = this._board(TUT, s.tbr, s.tsel, s.terr, this.tnb, true);
    const total = PUZZLE.isl.length, wide = s.wide;
    const streak = (p.puzzleStreak ?? 4) + (s.view === "solved" ? 1 : 0);
    const balance = p.balance ?? 1e9, canHint = s.hints < HINTS && balance >= HINT_COST;
    const finishTut = () => { if (p.onTutorialDone) p.onTutorialDone(); this.setState({ view: p.solved ? "solved" : "play", step: 0 }); };
    const step = STEPS[s.step], last = s.step === STEPS.length - 1;
    const remind = p.remind ?? false;
    return {
      cardMax: s.view === "play" && wide ? "880px" : "520px",
      veilAnim: s.closing ? "oc-veil-out 170ms var(--ease-standard) both" : "oc-veil-in var(--duration-base,200ms) var(--ease-out) both",
      cardAnim: s.closing ? "oc-dlg-out 170ms var(--ease-standard) both" : "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both",
      onClose: () => this._close(),
      isTutorial: s.view === "tutorial", isPlay: s.view === "play", isSolved: s.view === "solved",
      headTitle: s.view === "tutorial" ? "How Bridges works" : "The Daily #20734",
      headSub: s.view === "tutorial" ? "Step " + (s.step + 1) + " of " + STEPS.length + " · about 30 seconds" : "Bridges · Easy",
      skipLabel: p.tutorialSeen ? "Back to puzzle" : "Skip",
      skipTutorial: finishTut,
      openTutorial: () => this.setState({ view: "tutorial", step: 0, tbr: {}, tsel: null }),
      tb, pb, wide,
      stepTitle: step.t, stepBody: step.b,
      stepDots: STEPS.map((_, i) => ({ w: i === s.step ? "22px" : "6px", bg: i <= s.step ? "var(--accent,#FF5672)" : "var(--overlay-3,rgba(255,255,255,.16))" })),
      hasStepBack: s.step > 0, stepBack: () => this.setState(x => ({ step: Math.max(0, x.step - 1) })),
      stepNextLabel: last ? (p.tutorialSeen ? "Back to puzzle" : "Start today's puzzle") : "Next",
      stepNext: () => last ? finishTut() : this.setState(x => ({ step: x.step + 1 })),
      stats: [
        { label: "Time", value: fmtT(s.elapsed), mask: "var(--icon-timer) center/contain no-repeat", ink: "var(--ink,#ECECF1)", font: "var(--font-mono)" },
        { label: "Hints used", value: s.hints + (s.hints === 1 ? " hint" : " hints"), mask: "var(--icon-spark) center/contain no-repeat", ink: "var(--ink,#ECECF1)", font: "var(--font-sans)" },
        { label: "Puzzle streak", value: streak + (streak === 1 ? " day" : " days"), mask: "var(--icon-flame) center/contain no-repeat", ink: "var(--status-chit,#FF9F45)", font: "var(--font-sans)" },
      ],
      playCols: wide ? "minmax(0,1fr) 300px" : "minmax(0,1fr)",
      doneText: pb.doneN + " / " + total, donePct: Math.round(pb.doneN / total * 100) + "%",
      rules: [
        { n: "1", t: "Each number is how many bridges touch that island." },
        { n: "2", t: "Tap two islands in a row or column to connect them; tap again for a double." },
        { n: "3", t: "Bridges run straight and never cross. At most two join a pair." },
        { n: "4", t: "Everything ends up connected." },
      ],
      undo: () => { if (!s.hist.length) return; this.setState(x => ({ br: x.hist[x.hist.length - 1], hist: x.hist.slice(0, -1), sel: null }), () => this._save()); },
      undoDisabled: String(!s.hist.length), undoOpacity: s.hist.length || Object.keys(s.br).length ? 1 : 0.45,
      reset: () => { if (!Object.keys(s.br).length) return; this.setState(x => ({ br: {}, hist: x.hist.concat([x.br]), sel: null }), () => this._save()); },
      hint: () => this._hint(), hintDisabled: String(!canHint), hintOpacity: canHint ? 1 : 0.45,
      hintMeta: s.hints >= HINTS ? "none left" : HINT_COST + " CHIT · " + (HINTS - s.hints) + " left",
      solvedTitle: "Solved in " + fmtT(p.solved && p.solvedTime != null ? p.solvedTime : s.elapsed),
      result: [
        { label: "Time", value: fmtT(p.solved && p.solvedTime != null ? p.solvedTime : s.elapsed), ink: "var(--ink,#ECECF1)" },
        { label: "Hints", value: String(p.solved && p.solvedHints != null ? p.solvedHints : s.hints), ink: "var(--ink,#ECECF1)" },
        { label: "Puzzle streak", value: String(p.solved ? (p.puzzleStreak ?? 5) : streak), ink: "var(--status-chit,#FF9F45)" },
      ],
      askRemind: !remind && !(p.asked ?? false) && s.answered === null,
      remindYes: () => { this.setState({ answered: true }); if (p.onRemind) p.onRemind(true); },
      remindNo: () => { this.setState({ answered: false }); if (p.onRemind) p.onRemind(false); },
      remindNote: s.answered === true ? "Reminders on. Turn them off in Profile → CHIT." : s.answered === false ? "No reminders. You'll still find it in CHIT." : "",
      remindNoteInk: s.answered ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#A3A3B2)",
      remindNoteMask: s.answered ? "var(--icon-check) center/contain no-repeat" : "var(--icon-info) center/contain no-repeat",
      share: () => { if (p.onShare) p.onShare(); this._close(); },
      nextLabel: "Next puzzle in " + (p.countdown ?? "10:57:11"),
    };
  }
}

export default Component;
