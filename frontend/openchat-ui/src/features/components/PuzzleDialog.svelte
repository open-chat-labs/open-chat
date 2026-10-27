<!-- The Daily puzzle: Bridges (hashi). Tutorial (a small board + four steps) → play (today's board, timer, hints,
     undo / reset) → solved (time, hints, streak, a one-time "remind me each day?" ask, share).
     Progress is reported through onProgress (on every move and on close) and restored from `saved`.
     Today's board comes from the host (`puzzle`, islands only: the solution never reaches the client). The host checks
     the result (onSolved) and supplies hints (onHint, charged there); both wait on its promise. -->
<script lang="ts" module>
  type Puzzle = { grid: number; isl: [number, number, number][]; sol?: [number, number, number][] };
  export type Bridges = Record<string, number>;
  /** Today's board. Islands are [x, y, bridges needed]. */
  export interface DailyPuzzle {
    id: string;
    /** Shown as "The Daily #number". */
    number: number;
    grid: number;
    islands: [number, number, number][];
    /** Resource key (or literal text); defaults to "Easy". */
    difficulty?: string;
  }

  // the tutorial board is fixed and ships with its solution; today's puzzle never does
  const TUT: Puzzle = { grid: 6, isl: [[1, 1, 3], [4, 1, 3], [1, 4, 2], [4, 4, 2]], sol: [[0, 1, 2], [0, 2, 1], [1, 3, 1], [2, 3, 1]] };
  // tutorial steps and rules are resource keys, translated at render
  const STEPS = ['target', 'connect', 'straight', 'linkAll'].map((k) => ({ t: `ui.puzzleDialog.tutorial.${k}.title`, b: `ui.puzzleDialog.tutorial.${k}.body` }));
  const RULES = ['count', 'connect', 'straight', 'connected'].map((k) => `ui.puzzleDialog.rules.${k}`);

  const pairKey = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const ends = (k: string) => k.split('-').map(Number) as [number, number];
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // the nearest island in each of the four directions
  function neighbours(isl: Puzzle['isl']) {
    return isl.map(([x, y], i) => {
      const out: number[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let best = -1, bd = 1e9;
        isl.forEach(([x2, y2], j) => {
          if (j === i) return;
          const d = dx ? (x2 - x) * dx : (y2 - y) * dy;
          if ((dx ? y2 === y : x2 === x) && d > 0 && d < bd) {
            bd = d;
            best = j;
          }
        });
        if (best >= 0) out.push(best);
      }
      return out;
    });
  }

  function crossesAny(isl: Puzzle['isl'], br: Bridges, i: number, j: number) {
    const [ax, ay] = isl[i], [bx, by] = isl[j], h = ay === by;
    return Object.keys(br).some((k) => {
      if (!br[k]) return false;
      const [p, q] = ends(k);
      const [cx, cy] = isl[p], [dx, dy] = isl[q];
      if ((cy === dy) === h) return false;
      if (h) return cx > Math.min(ax, bx) && cx < Math.max(ax, bx) && ay > Math.min(cy, dy) && ay < Math.max(cy, dy);
      return cy > Math.min(ay, by) && cy < Math.max(ay, by) && ax > Math.min(cx, dx) && ax < Math.max(cx, dx);
    });
  }

  function counts(isl: Puzzle['isl'], br: Bridges) {
    const c = isl.map(() => 0);
    for (const k of Object.keys(br)) {
      const [p, q] = ends(k);
      c[p] += br[k];
      c[q] += br[k];
    }
    return c;
  }

  function isSolved(isl: Puzzle['isl'], br: Bridges) {
    const c = counts(isl, br);
    if (c.some((v, i) => v !== isl[i][2])) return false;
    const adj: number[][] = isl.map(() => []);
    for (const k of Object.keys(br)) {
      if (!br[k]) continue;
      const [p, q] = ends(k);
      adj[p].push(q);
      adj[q].push(p);
    }
    const seen = new Set([0]), stack = [0];
    while (stack.length)
      for (const n of adj[stack.pop()!])
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
    return seen.size === isl.length;
  }

  const TNB = neighbours(TUT.isl);
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';

  interface Saved {
    /** The puzzle this progress is for (as onProgress reported it); progress for another puzzle is ignored. */
    puzzleId: string;
    br: Bridges;
    elapsed: number;
    hints: number;
  }

  interface Props {
    /** Skip the tutorial on open. */
    tutorialSeen?: boolean;
    /** Already solved today: open on the result. */
    solved?: boolean;
    /** Daily reminders already on. */
    remind?: boolean;
    /** Already asked about reminders. */
    asked?: boolean;
    /** Days in a row solved before today. */
    puzzleStreak: number;
    /** Today's board, from the host. */
    puzzle: DailyPuzzle;
    /** CHIT available for hints. */
    balance?: number;
    /** CHIT per hint and how many a day; hints are hidden when hintsAllowed is 0 (the default). */
    hintCost?: number;
    hintsAllowed?: number;
    /** Time until the next puzzle. */
    countdown?: string;
    /** Progress last reported by onProgress; used only when its puzzleId is this puzzle's. */
    saved?: Saved | null;
    /** Solved view: the recorded time / hints. */
    solvedTime?: number | null;
    solvedHints?: number | null;
    onProgress?: (p: Saved & { done: number; total: number }) => void;
    /** The board is complete: the host verifies it (and records the time). The solved view shows once this resolves;
     *  a rejection keeps the board in play with an error. */
    onSolved?: (r: { puzzleId: string; bridges: Bridges; elapsed: number; hints: number }) => Promise<unknown> | void;
    /** Hold a solve on the board (after onSolved) until the host sets `solvedReady`, e.g. once its celebration ends. */
    holdSolved?: boolean;
    solvedReady?: boolean;
    /** Charge for a hint and return one correct bridge [island i, island j, count]. Nothing changes if it rejects. */
    onHint?: (r: { puzzleId: string; bridges: Bridges; cost: number }) => Promise<[number, number, number]>;
    onRemind?: (on: boolean) => Promise<unknown> | void;
    onTutorialDone?: () => void;
    onShare?: (r: { puzzleId: string; number: number; time: number; hints: number; streak: number }) => Promise<unknown> | void;
    onClose?: () => void;
  }

  let {
    tutorialSeen = false,
    solved = false,
    remind = false,
    asked = false,
    puzzleStreak,
    puzzle,
    balance = 0,
    hintCost = 0,
    hintsAllowed = 0,
    countdown = '',
    saved = null,
    solvedTime = null,
    solvedHints = null,
    onProgress,
    onSolved,
    holdSolved = false,
    solvedReady = false,
    onHint,
    onRemind,
    onTutorialDone,
    onShare,
    onClose,
  }: Props = $props();
  const t = useT();

  let view = $state<'tutorial' | 'play' | 'solved'>(untrack(() => (solved ? 'solved' : tutorialSeen ? 'play' : 'tutorial')));
  // a solve the host holds on the board (holdSolved) until its celebration is over (solvedReady)
  let awaitingReveal = $state(false);
  $effect(() => {
    if (awaitingReveal && solvedReady) {
      awaitingReveal = false;
      view = 'solved';
    }
  });
  let step = $state(0);
  // progress for another puzzle (e.g. yesterday's, kept past the daily rollover) is ignored; bridges must join two of
  // this board's islands, so a stale key can never break the board
  const restored = untrack(() => (saved && saved.puzzleId === puzzle.id ? saved : null));
  const onBoard = (b: Bridges | undefined) => {
    const n = untrack(() => puzzle.islands.length);
    return Object.fromEntries(
      Object.entries(b ?? {}).filter(([k, v]) => {
        const m = /^(\d+)-(\d+)$/.exec(k);
        return !!m && +m[1] < +m[2] && +m[2] < n && (v === 1 || v === 2);
      }),
    ) as Bridges;
  };
  let br = $state<Bridges>(onBoard(restored?.br));
  let hist = $state<Bridges[]>([]);
  let sel = $state<number | null>(null);
  let err = $state('');
  let elapsed = $state(restored?.elapsed ?? 0);
  let hints = $state(restored?.hints ?? 0);
  let tbr = $state<Bridges>({});
  let tsel = $state<number | null>(null);
  let terr = $state('');
  let answered = $state<boolean | null>(null);
  let checkFailed = $state(false);
  // the shared dialog contract (lib/behaviours/dialog.svelte.ts): `flow` owns the solve check, sharing and the exit;
  // `hintFlow` the paid hint. Nothing closes while either is pending, and nothing starts while leaving.
  const flow = new DialogFlow();
  const hintFlow = new DialogFlow();
  // the board is locked while the host checks a solve, and while it holds one (holdSolved)
  const checking = $derived(flow.busy || awaitingReveal);
  const hinting = $derived(hintFlow.busy);
  const PUZZLE = $derived<Puzzle>({ grid: puzzle.grid, isl: puzzle.islands });
  const NB = $derived(neighbours(PUZZLE.isl));
  let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const wide = $derived(innerWidth >= 900);

  let errTimer: ReturnType<typeof setTimeout> | undefined;
  let solveTimer: ReturnType<typeof setTimeout> | undefined;
  let layer: HTMLDivElement;

  function save() {
    onProgress?.({ puzzleId: puzzle.id, br, elapsed, hints, done: counts(PUZZLE.isl, br).filter((v, i) => v === PUZZLE.isl[i][2]).length, total: PUZZLE.isl.length });
  }

  onMount(() => {
    const tick = setInterval(() => {
      if (view === 'play' && !flow.closing) elapsed++;
    }, 1000);
    // Esc closes, but only while this is the topmost dialog (shared stack with DialogShell)
    const self = { boxRef: { get current() { return layer; } } };
    const stack = (): object[] => ((window as unknown as { __ocDialogs?: object[] }).__ocDialogs ??= []);
    stack().push(self);
    const key = (e: KeyboardEvent) => {
      const s = stack();
      if (e.key === 'Escape' && s[s.length - 1] === self) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      clearInterval(tick);
      window.removeEventListener('keydown', key);
      const s = stack(), i = s.indexOf(self);
      if (i >= 0) s.splice(i, 1);
    };
  });

  onDestroy(() => {
    clearTimeout(errTimer);
    flow.destroy();
    hintFlow.destroy();
    clearTimeout(solveTimer);
    save();
  });

  // Esc / veil / × / Done: not while a hint is being bought or the board is being checked
  function close() {
    if (hinting) return;
    flow.dismiss(onClose);
  }

  function flash(tut: boolean, msg: string) {
    clearTimeout(errTimer);
    if (tut) terr = msg;
    else err = msg;
    errTimer = setTimeout(() => (tut ? (terr = '') : (err = '')), 1600);
  }

  function commit(tut: boolean, next: Bridges) {
    if (tut) {
      tbr = next;
      return;
    }
    hist = [...hist, br].slice(-50);
    br = next;
    boardChanged();
  }

  // any move cancels a pending check; a complete board is checked shortly after, as it is then — but not while a hint
  // is being bought (the hint's own move schedules the check once it lands)
  function boardChanged() {
    clearTimeout(solveTimer);
    checkFailed = false;
    save();
    if (isSolved(PUZZLE.isl, br) && !hinting) solveTimer = setTimeout(submit, 550);
  }

  // the host has the final say on a solve; the board is locked while it checks
  async function submit() {
    if (hinting || !isSolved(PUZZLE.isl, br)) return;
    const bridges = br;
    checkFailed = false;
    // ignored while a check is already running or the dialog is leaving
    const result = await flow.run(() => onSolved?.({ puzzleId: puzzle.id, bridges, elapsed, hints }));
    if (result.ok) {
      if (holdSolved && !solvedReady) awaitingReveal = true;
      else view = 'solved';
    } else if (flow.failed) {
      checkFailed = true;
      flash(false, 'ui.puzzleDialog.solveFailed');
    }
  }

  function press(tut: boolean, i: number) {
    if (!tut && checking) return;
    const P = tut ? TUT : PUZZLE, nb = tut ? TNB : NB;
    const current = tut ? tsel : sel;
    const select = (v: number | null) => (tut ? (tsel = v) : (sel = v));
    if (current === null || current === i) return select(current === i ? null : i);
    if (!nb[current].includes(i)) return select(i);
    const bridges = tut ? tbr : br;
    const k = pairKey(current, i), cur = bridges[k] || 0, next = (cur + 1) % 3;
    if (cur === 0 && crossesAny(P.isl, bridges, current, i)) {
      select(null);
      return flash(tut, 'ui.puzzleDialog.cantCross');
    }
    const updated = { ...bridges, [k]: next };
    if (!next) delete updated[k];
    select(null);
    commit(tut, updated);
  }

  function remove(tut: boolean, k: string) {
    if (!tut && checking) return;
    const updated = { ...(tut ? tbr : br) };
    delete updated[k];
    commit(tut, updated);
  }

  const canHint = $derived(!!onHint && hints < hintsAllowed && balance >= hintCost && !hinting);

  // the host charges for the hint and returns one bridge of the solution; it's applied only once that resolves
  async function hint() {
    // not while the board is being checked or the dialog is leaving
    if (!canHint || !onHint || flow.locked) return;
    clearTimeout(solveTimer); // a check waits for the hint
    const result = await hintFlow.run(() => onHint({ puzzleId: puzzle.id, bridges: br, cost: hintCost }));
    if (!result.ok) {
      if (hintFlow.failed) flash(false, 'ui.puzzleDialog.hintFailed');
      boardChanged(); // a complete board that waited for the hint is checked now
      return;
    }
    // the host has charged for it, so it is applied (also from the tutorial or after a failed check) unless the
    // puzzle is already solved
    if (view === 'solved') return;
    const [i, j, n] = result.value, next = { ...br };
    // a correct bridge can't cross another correct one, so whatever blocks it is wrong
    for (const k of Object.keys(next)) if (crossesAny(PUZZLE.isl, { [k]: next[k] }, i, j)) delete next[k];
    next[pairKey(i, j)] = n;
    hints++;
    sel = null;
    commit(false, next);
  }

  async function remindAnswer(on: boolean) {
    try {
      await onRemind?.(on);
      answered = on;
    } catch {
      // the ask stays so the user can try again
    }
  }

  async function share() {
    if (!onShare) return;
    // one share at a time; it stays open (to retry) if it fails, and leaves once it's done
    const result = await flow.run(() => onShare({ puzzleId: puzzle.id, number: puzzle.number, time: solved && solvedTime != null ? solvedTime : elapsed, hints: solved && solvedHints != null ? solvedHints : hints, streak: solved ? puzzleStreak : streak }));
    if (result.ok) flow.leave(onClose);
  }

  function undo() {
    if (!hist.length || checking) return;
    br = hist[hist.length - 1];
    hist = hist.slice(0, -1);
    sel = null;
    boardChanged();
  }

  function reset() {
    if (!Object.keys(br).length || checking) return;
    hist = [...hist, br];
    br = {};
    sel = null;
    boardChanged();
  }

  function finishTutorial() {
    onTutorialDone?.();
    view = solved ? 'solved' : 'play';
    step = 0;
  }

  function board(P: Puzzle, bridges: Bridges, selected: number | null, nb: number[][]) {
    const cell = 100 / P.grid, D = cell * 0.66, c = counts(P.isl, bridges);
    const cand = selected === null ? [] : nb[selected];
    const islands = P.isl.map(([x, y, n], i) => ({
      n,
      count: c[i],
      left: `${(x + 0.5) * cell - D / 2}%`,
      top: `${(y + 0.5) * cell - D / 2}%`,
      done: c[i] === n,
      over: c[i] > n,
      selected: selected === i,
      candidate: cand.includes(i),
    }));
    const lines = Object.keys(bridges)
      .filter((k) => bridges[k])
      .map((k) => {
        const [p, q] = ends(k), [ax, ay] = P.isl[p], [bx, by] = P.isl[q], h = ay === by;
        const x1 = (Math.min(ax, bx) + 0.5) * cell, x2 = (Math.max(ax, bx) + 0.5) * cell, y1 = (Math.min(ay, by) + 0.5) * cell, y2 = (Math.max(ay, by) + 0.5) * cell;
        return {
          k,
          h,
          count: bridges[k],
          over: [p, q].some((i) => c[i] > P.isl[i][2]),
          left: h ? `${x1}%` : `calc(${x1}% - 10px)`,
          top: h ? `calc(${y1}% - 10px)` : `${y1}%`,
          width: h ? `${x2 - x1}%` : '20px',
          height: h ? '20px' : `${y2 - y1}%`,
        };
      });
    return { islands, lines, cell: `${cell}%`, size: D, fontSize: P.grid === 7 ? '5.4cqw' : '7.4cqw', doneN: islands.filter((s) => s.done).length };
  }

  const pb = $derived(board(PUZZLE, br, sel, NB));
  const tb = $derived(board(TUT, tbr, tsel, TNB));
  const tutDone = $derived(isSolved(TUT.isl, tbr));
  const streak = $derived(puzzleStreak + (view === 'solved' ? 1 : 0));
  const resultTime = $derived(fmtT(solved && solvedTime != null ? solvedTime : elapsed));
</script>

<svelte:window bind:innerWidth />

{#snippet boardView(b: ReturnType<typeof board>, tut: boolean, message: string, extra: boolean)}
  <div class="board" class:tutorial={tut} class:locked={!tut && checking} aria-busy={!tut && checking} style:background-size="{b.cell} {b.cell}">
    {#each b.lines as line (line.k)}<span
        class="bridge"
        class:vertical={!line.h}
        class:over={line.over}
        style:left={line.left}
        style:top={line.top}
        style:width={line.width}
        style:height={line.height}
        onclick={() => remove(tut, line.k)}
        title={t('ui.puzzleDialog.removeBridge')}>{#each { length: line.count } as _}<span class="bridge-line"></span>{/each}</span
      >{/each}
    {#each b.islands as island, i}<button
        class="island"
        class:done={island.done}
        class:over={island.over}
        class:selected={island.selected}
        class:candidate={island.candidate}
        style:left={island.left}
        style:top={island.top}
        style:width="{b.size}%"
        style:font-size={b.fontSize}
        onclick={() => press(tut, i)}
        disabled={!tut && checking}
        aria-label={t('ui.puzzleDialog.island', { n: island.n, count: island.count, selected: String(island.selected) })}>{island.n}</button
      >{/each}
    {#if extra}<span class="toast ok"><span class="toast-check"></span>{t('ui.puzzleDialog.nice')}</span>{/if}
    {#if message}<span class="toast error" role="status">{t(message)}</span>{/if}
  </div>
{/snippet}

<div class="layer oc-dialog-layer" bind:this={layer} class:closing={flow.closing} data-screen-label="Daily puzzle" role="dialog" aria-modal="true" aria-label={t('ui.puzzleDialog.label')}>
  <div class="oc-veil" onclick={close} aria-hidden="true"></div>
  <div class="card" class:wide={view === 'play' && wide}>
    <div class="head">
      <span class="badge"><span class="badge-icon"></span></span>
      <span class="heading"
        ><span class="title">{view === 'tutorial' ? t('ui.puzzleDialog.howTitle') : t('ui.puzzleDialog.dailyTitle', { number: puzzle.number })}</span><span class="subtitle"
          >{view === 'tutorial' ? t('ui.puzzleDialog.tutorialStep', { step: step + 1, total: STEPS.length }) : t('ui.puzzleDialog.gameMeta', { difficulty: t(puzzle.difficulty ?? 'ui.puzzleDialog.difficulty.easy') })}</span
        ></span
      >
      {#if view === 'tutorial'}
        <span class="skip" onclick={finishTutorial} role="button" tabindex="0">{t(tutorialSeen ? 'ui.puzzleDialog.backToPuzzle' : 'ui.puzzleDialog.skip')}</span>
      {/if}
      {#if view === 'play'}
        <span
          class="head-button"
          onclick={() => {
            view = 'tutorial';
            step = 0;
            tbr = {};
            tsel = null;
          }}
          role="button"
          tabindex="0"
          title={t('ui.puzzleDialog.howToPlay')}
          aria-label={t('ui.puzzleDialog.howToPlay')}><span class="head-glyph info"></span></span
        >
      {/if}
      <span class="head-button" onclick={close} role="button" tabindex="0" title={t('ui.common.close')} aria-label={t('ui.common.close')}><span class="head-glyph cross"></span></span>
    </div>

    {#if view === 'tutorial'}
      <div class="tutorial-view">
        {@render boardView(tb, true, terr, tutDone)}
        <div class="step">
          <span class="step-title">{t(STEPS[step].t)}</span>
          <span class="step-body">{t(STEPS[step].b)}</span>
        </div>
        <div class="step-nav">
          <span class="dots" aria-hidden="true">{#each STEPS as _, i}<span class="dot" class:current={i === step} class:passed={i <= step}></span>{/each}</span>
          {#if step > 0}<span class="nav-button" onclick={() => (step = Math.max(0, step - 1))} role="button" tabindex="0">{t('ui.common.back')}</span>{/if}
          <span class="nav-button primary" onclick={() => (step === STEPS.length - 1 ? finishTutorial() : step++)} role="button" tabindex="0"
            >{step === STEPS.length - 1 ? t(tutorialSeen ? 'ui.puzzleDialog.backToPuzzle' : 'ui.puzzleDialog.startToday') : t('ui.common.next')}</span
          >
        </div>
      </div>
    {/if}

    {#if view === 'play'}
      <div class="play-view">
        <div class="stats">
          <span class="stat" title={t('ui.puzzleDialog.time')}><span class="stat-icon" style:mask="var(--icon-timer) center/contain no-repeat"></span><span class="mono">{fmtT(elapsed)}</span></span>
          <span class="stat" title={t('ui.puzzleDialog.hintsUsed')}><span class="stat-icon" style:mask="var(--icon-spark) center/contain no-repeat"></span><span>{t('ui.puzzleDialog.hintCount', { count: hints })}</span></span>
          <span class="stat streak" title={t('ui.puzzleDialog.puzzleStreak')}
            ><span class="stat-icon" style:mask="var(--icon-flame) center/contain no-repeat"></span><span>{t('ui.puzzleDialog.dayCount', { count: streak })}</span></span
          >
        </div>
        <div class="play-grid">
          {@render boardView(pb, false, err, false)}
          <div class="side">
            <div class="progress">
              <span class="progress-head"><span>{t('ui.puzzleDialog.islandsComplete')}</span><span class="mono soft">{pb.doneN} / {PUZZLE.isl.length}</span></span>
              <span class="progress-track"><span class="progress-fill" style:width="{Math.round((pb.doneN / PUZZLE.isl.length) * 100)}%"></span></span>
            </div>
            {#if wide}
              <div class="rules">
                <span class="rules-title">{t('ui.puzzleDialog.rulesTitle')}</span>
                {#each RULES as rule, i}<span class="rule"><span class="rule-n">{i + 1}</span>{t(rule)}</span>{/each}
              </div>
              <span class="grow"></span>
            {/if}
            <div class="actions">
              <span class="action" style:opacity={hist.length || Object.keys(br).length ? 1 : 0.45} onclick={undo} role="button" tabindex="0" aria-disabled={!hist.length}
                ><span class="action-icon" style:mask="var(--icon-rotate-back) center/contain no-repeat"></span>{t('ui.common.undo')}</span
              >
              <span class="action" style:opacity={hist.length || Object.keys(br).length ? 1 : 0.45} onclick={reset} role="button" tabindex="0"
                ><span class="action-icon" style:mask="var(--icon-refresh) center/contain no-repeat"></span>{t('ui.puzzleDialog.reset')}</span
              >
            </div>
            {#if flow.busy}
              <span class="check-status" role="status">{t('ui.puzzleDialog.checking')}</span>
            {:else if checkFailed}
              <span class="action retry" onclick={submit} role="button" tabindex="0"
                ><span class="action-icon" style:mask="var(--icon-refresh) center/contain no-repeat"></span>{t('ui.puzzleDialog.checkAgain')}</span
              >
            {/if}
            {#if hintsAllowed > 0 && onHint}
              <span class="hint" style:opacity={canHint ? 1 : 0.45} onclick={hint} role="button" tabindex="0" aria-disabled={!canHint}
                ><span class="hint-icon"></span>{t('ui.puzzleDialog.useHint')}<span class="hint-meta">{hints >= hintsAllowed ? t('ui.puzzleDialog.noneLeft') : t('ui.puzzleDialog.hintCost', { cost: hintCost, left: hintsAllowed - hints })}</span></span
              >
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if view === 'solved'}
      <div class="solved-view">
        <span class="trophy"><span class="trophy-icon"></span></span>
        <span class="solved-heading"><span class="solved-title">{t('ui.puzzleDialog.solvedIn', { time: resultTime })}</span><span class="solved-sub">{t('ui.puzzleDialog.dailyTitle', { number: puzzle.number })} · {t('ui.puzzleDialog.gameMeta', { difficulty: t(puzzle.difficulty ?? 'ui.puzzleDialog.difficulty.easy') })}</span></span>
        <div class="results">
          <span class="result"><span class="result-value">{resultTime}</span><span class="result-label">{t('ui.puzzleDialog.time')}</span></span>
          <span class="result"><span class="result-value">{solved && solvedHints != null ? solvedHints : hints}</span><span class="result-label">{t('ui.puzzleDialog.hints')}</span></span>
          <span class="result"><span class="result-value chit">{solved ? puzzleStreak : streak}</span><span class="result-label">{t('ui.puzzleDialog.puzzleStreak')}</span></span>
        </div>
        {#if !remind && !asked && answered === null}
          <div class="ask">
            <span class="ask-icon"><span class="bell"></span></span>
            <span class="ask-text"><span class="ask-title">{t('ui.puzzleDialog.remindTitle')}</span><span class="ask-sub">{t('ui.puzzleDialog.remindSub')}</span></span>
            <span class="ask-buttons">
              <span
                class="ask-no"
                onclick={() => remindAnswer(false)}
                role="button"
                tabindex="0">{t('ui.puzzleDialog.notNow')}</span
              >
              <span
                class="ask-yes"
                onclick={() => remindAnswer(true)}
                role="button"
                tabindex="0">{t('ui.puzzleDialog.yes')}</span
              >
            </span>
          </div>
        {/if}
        {#if answered !== null}
          <span class="remind-note" role="status"
            ><span class="remind-icon" class:on={answered}></span>{t(answered ? 'ui.puzzleDialog.remindersOn' : 'ui.puzzleDialog.remindersOff')}</span
          >
        {/if}
        <div class="finish">
          {#if onShare}
            <span class="finish-button" onclick={share} role="button" tabindex="0" aria-disabled={flow.locked}><span class="share-icon"></span>{t('ui.puzzleDialog.share')}</span>
          {/if}
          <span class="finish-button" onclick={close} role="button" tabindex="0">{t('ui.common.done')}</span>
        </div>
        <span class="next">{t('ui.puzzleDialog.nextIn', { countdown })}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    z-index: 74;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    width: 100%;
    max-width: 520px;
    max-height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    padding: var(--space-18) var(--space-20, 20px) var(--space-20, 20px);
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 24px 60px rgba(0, 0, 0, 0.5);
    color: var(--ink);
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .card.wide {
    max-width: 880px;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
  }

  .badge {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-icon {
    width: 18px;
    height: 18px;
    background: var(--accent-bright);
    mask: var(--icon-joystick) center/contain no-repeat;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .subtitle {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .skip {
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
  }

  .skip:hover {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .head-button {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .head-button:hover {
    background: var(--overlay-2);
  }

  .head-glyph {
    background: var(--ink-3);
  }

  .head-glyph.info {
    width: 16px;
    height: 16px;
    mask: var(--icon-info) center/contain no-repeat;
  }

  .head-glyph.cross {
    width: 15px;
    height: 15px;
    mask: var(--icon-close) center/contain no-repeat;
  }

  .tutorial-view,
  .play-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .play-view {
    gap: var(--space-14);
  }

  .board {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    container-type: inline-size;
    border-radius: var(--radius-lg);
    background: var(--surface-2) radial-gradient(circle, var(--line-2) 1.2px, transparent 1.8px) 0 0;
    box-shadow: inset 0 0 0 1px var(--line-1);
    user-select: none;
  }

  .board.tutorial {
    max-width: 420px;
    align-self: center;
  }

  .bridge {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  }

  .bridge.vertical {
    flex-direction: row;
  }

  .bridge-line {
    flex: none;
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: var(--ink-2);
  }

  .vertical .bridge-line {
    width: 3px;
    height: 100%;
  }

  .over .bridge-line {
    background: var(--status-danger);
  }

  .island {
    position: absolute;
    aspect-ratio: 1;
    border: 0;
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3, #24242e);
    box-shadow: inset 0 0 0 1.5px var(--line-3);
    color: var(--ink);
    font-family: var(--font-sans);
    font-weight: var(--weight-bold);
    line-height: 1;
    cursor: pointer;
    transition:
      background 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out),
      transform 160ms var(--ease-out);
  }

  .island.done {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: none;
  }

  .island.candidate {
    box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--accent) 70%, transparent);
  }

  .island.selected {
    box-shadow:
      0 0 0 4px color-mix(in oklch, var(--accent) 45%, transparent),
      inset 0 0 0 2px var(--accent-bright);
    transform: scale(1.06);
  }

  .island.over {
    box-shadow: inset 0 0 0 2px var(--status-danger);
  }

  .toast {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    white-space: nowrap;
  }

  .toast.ok {
    gap: 6px;
    background: var(--status-online);
    color: #062a1d;
    font-weight: var(--weight-bold);
  }

  .toast.error {
    background: var(--status-danger);
    color: #fff;
    animation: oc-pz-shake 240ms var(--ease-out);
  }

  .toast-check {
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 64px;
  }

  .step-title {
    font: var(--weight-bold) var(--text-md) / 1.2 var(--font-sans);
  }

  .step-body {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .step-nav {
    display: flex;
    align-items: center;
    gap: var(--space-10);
  }

  .dots {
    flex: 1;
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: var(--overlay-3, rgba(255, 255, 255, 0.16));
    transition:
      width 200ms var(--ease-out),
      background 200ms;
  }

  .dot.passed {
    background: var(--accent);
  }

  .dot.current {
    width: 22px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    height: 42px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .nav-button:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .nav-button.primary {
    padding: 0 var(--space-18);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: var(--weight-bold);
  }

  .nav-button.primary:hover {
    filter: brightness(1.08);
  }

  .stats {
    display: flex;
    gap: 8px;
  }

  .stat {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
  }

  .stat.streak {
    color: var(--status-chit);
  }

  .stat-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: currentColor;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .soft {
    color: var(--ink-2);
  }

  .play-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-20, 20px);
    align-items: stretch;
  }

  .wide .play-grid {
    grid-template-columns: minmax(0, 1fr) 300px;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  .progress-head {
    display: flex;
    justify-content: space-between;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
  }

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--overlay-2);
    overflow: hidden;
  }

  .progress-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width 240ms var(--ease-out);
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: 9px;
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-2);
  }

  .rules-title {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .rule {
    display: flex;
    gap: 8px;
    text-wrap: pretty;
  }

  .rule-n {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--overlay-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font: var(--weight-bold) 10.5px/1 var(--font-mono);
  }

  .grow {
    flex: 1;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 42px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .action:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .action-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--status-chit) 16%, var(--surface-2));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-chit) 35%, transparent);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .hint:hover {
    filter: brightness(1.12);
  }

  .hint-icon {
    width: 15px;
    height: 15px;
    background: var(--status-chit);
    mask: var(--icon-spark) center/contain no-repeat;
  }

  .hint-meta {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .solved-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-16);
    text-align: center;
    padding-top: var(--space-6);
  }

  .trophy {
    width: 80px;
    height: 80px;
    border-radius: 24px;
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: oc-pz-pop 420ms var(--ease-out) both;
  }

  .trophy-icon {
    width: 38px;
    height: 38px;
    background: var(--accent-bright);
    mask: var(--icon-trophy) center/contain no-repeat;
  }

  .solved-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .solved-title {
    font: var(--weight-bold) 22px/1.1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .solved-sub {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .results {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 8px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }

  .result-value {
    font: var(--weight-bold) 17px/1 var(--font-mono);
    color: var(--ink);
  }

  .result-value.chit {
    color: var(--status-chit);
  }

  .result-label {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .ask {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-12);
    padding: 12px;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 35%, transparent);
    text-align: start;
  }

  .ask-icon {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--overlay-2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bell {
    width: 17px;
    height: 17px;
    background: var(--ink);
    mask: var(--icon-bell) center/contain no-repeat;
  }

  .ask-text {
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ask-title {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
  }

  .ask-sub {
    font: var(--weight-medium) var(--text-xs) / 1.35 var(--font-sans);
    color: var(--ink-3);
  }

  .ask-buttons {
    flex: none;
    display: flex;
    gap: 4px;
  }

  .ask-no,
  .ask-yes {
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .ask-no {
    color: var(--ink-2);
  }

  .ask-no:hover {
    background: var(--overlay-2);
  }

  .ask-yes {
    padding: 0 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: var(--weight-bold);
  }

  .ask-yes:hover {
    filter: brightness(1.08);
  }

  .remind-note {
    display: flex;
    align-items: center;
    gap: 7px;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .remind-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3);
    mask: var(--icon-info) center/contain no-repeat;
  }

  .remind-icon.on {
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .finish {
    width: 100%;
    display: flex;
    gap: 8px;
  }

  .finish-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
  }

  .finish-button:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .share-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
    mask: var(--icon-share) center/contain no-repeat;
  }

  .next {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .board.locked {
    opacity: 0.7;
    pointer-events: none;
  }

  .check-status {
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .action.retry {
    align-self: flex-start;
  }
</style>
