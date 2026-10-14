<!-- The Daily puzzle: Bridges (hashi). Tutorial (a small board + four steps) → play (today's board, timer, hints,
     undo / reset) → solved (time, hints, streak, a one-time "remind me each day?" ask, share).
     Progress is reported through onProgress (on every move and on close) and restored from `saved`. -->
<script lang="ts" module>
  type Puzzle = { grid: number; isl: [number, number, number][]; sol: [number, number, number][] };
  export type Bridges = Record<string, number>;

  // islands [x, y, n]; sol lists [i, j, count] — a valid solution used for hints
  const PUZZLE: Puzzle = {
    grid: 7,
    isl: [[0, 0, 3], [3, 0, 3], [6, 0, 3], [0, 2, 4], [2, 2, 4], [5, 2, 1], [2, 4, 3], [4, 4, 4], [6, 4, 4], [0, 6, 3], [4, 6, 4], [6, 6, 2]],
    sol: [[0, 1, 2], [1, 2, 1], [0, 3, 1], [2, 8, 2], [3, 4, 2], [4, 5, 1], [4, 6, 1], [6, 7, 2], [7, 8, 1], [7, 10, 1], [3, 9, 1], [9, 10, 2], [10, 11, 1], [8, 11, 1]],
  };
  const TUT: Puzzle = { grid: 6, isl: [[1, 1, 3], [4, 1, 3], [1, 4, 2], [4, 4, 2]], sol: [[0, 1, 2], [0, 2, 1], [1, 3, 1], [2, 3, 1]] };
  // tutorial steps and rules are resource keys, translated at render
  const STEPS = ['target', 'connect', 'straight', 'linkAll'].map((k) => ({ t: `ui.puzzleDialog.tutorial.${k}.title`, b: `ui.puzzleDialog.tutorial.${k}.body` }));
  const RULES = ['count', 'connect', 'straight', 'connected'].map((k) => `ui.puzzleDialog.rules.${k}`);
  const HINT_COST = 100;
  const HINTS = 3;

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
    while (stack.length) for (const n of adj[stack.pop()!]) if (!seen.has(n)) (seen.add(n), stack.push(n));
    return seen.size === isl.length;
  }

  const NB = neighbours(PUZZLE.isl);
  const TNB = neighbours(TUT.isl);
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { onDestroy, onMount, untrack } from 'svelte';

  interface Saved {
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
    /** CHIT available for hints; unlimited when absent. */
    balance?: number;
    /** Time until the next puzzle. */
    countdown?: string;
    saved?: Saved | null;
    /** Solved view: the recorded time / hints. */
    solvedTime?: number | null;
    solvedHints?: number | null;
    onProgress?: (p: Saved & { done: number; total: number }) => void;
    onSolved?: (r: { elapsed: number; hints: number }) => void;
    onHint?: (cost: number) => void;
    onRemind?: (on: boolean) => void;
    onTutorialDone?: () => void;
    onShare?: () => void;
    onClose?: () => void;
  }

  let {
    tutorialSeen = false,
    solved = false,
    remind = false,
    asked = false,
    puzzleStreak,
    balance = Infinity,
    countdown = '',
    saved = null,
    solvedTime = null,
    solvedHints = null,
    onProgress,
    onSolved,
    onHint,
    onRemind,
    onTutorialDone,
    onShare,
    onClose,
  }: Props = $props();
  const t = useT();

  let view = $state<'tutorial' | 'play' | 'solved'>(untrack(() => (solved ? 'solved' : tutorialSeen ? 'play' : 'tutorial')));
  let step = $state(0);
  let br = $state<Bridges>(untrack(() => saved?.br ?? {}));
  let hist = $state<Bridges[]>([]);
  let sel = $state<number | null>(null);
  let err = $state('');
  let elapsed = $state(untrack(() => saved?.elapsed ?? 0));
  let hints = $state(untrack(() => saved?.hints ?? 0));
  let tbr = $state<Bridges>({});
  let tsel = $state<number | null>(null);
  let terr = $state('');
  let closing = $state(false);
  let answered = $state<boolean | null>(null);
  let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const wide = $derived(innerWidth >= 900);

  let errTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let solveTimer: ReturnType<typeof setTimeout> | undefined;
  let layer: HTMLDivElement;

  function save() {
    onProgress?.({ br, elapsed, hints, done: counts(PUZZLE.isl, br).filter((v, i) => v === PUZZLE.isl[i][2]).length, total: PUZZLE.isl.length });
  }

  onMount(() => {
    const tick = setInterval(() => {
      if (view === 'play' && !closing) elapsed++;
    }, 1000);
    // Esc closes, but only while this is the topmost dialog (shared stack with DialogShell)
    const self = { boxRef: { get current() { return layer; } } };
    const stack = (): object[] => ((window as any).__ocDialogs ??= []);
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
    clearTimeout(closeTimer);
    clearTimeout(solveTimer);
    save();
  });

  function close() {
    if (closing) return;
    closing = true;
    closeTimer = setTimeout(() => onClose?.(), 170);
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
    save();
    if (isSolved(PUZZLE.isl, next))
      solveTimer = setTimeout(() => {
        view = 'solved';
        onSolved?.({ elapsed, hints });
      }, 550);
  }

  function press(tut: boolean, i: number) {
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
    const updated = { ...(tut ? tbr : br) };
    delete updated[k];
    commit(tut, updated);
  }

  const canHint = $derived(hints < HINTS && balance >= HINT_COST);

  function hint() {
    if (!canHint) return;
    const target = PUZZLE.sol.find(([i, j, n]) => (br[pairKey(i, j)] || 0) !== n);
    if (!target) return;
    const [i, j, n] = target, next = { ...br };
    // drop wrong bridges that would block the hinted one
    for (const k of Object.keys(next)) if (crossesAny(PUZZLE.isl, { [k]: next[k] }, i, j) && !PUZZLE.sol.some(([a, b]) => pairKey(a, b) === k)) delete next[k];
    next[pairKey(i, j)] = n;
    hints++;
    onHint?.(HINT_COST);
    sel = null;
    commit(false, next);
  }

  function undo() {
    if (!hist.length) return;
    br = hist[hist.length - 1];
    hist = hist.slice(0, -1);
    sel = null;
    save();
  }

  function reset() {
    if (!Object.keys(br).length) return;
    hist = [...hist, br];
    br = {};
    sel = null;
    save();
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
  <div class="board" class:tutorial={tut} style:background-size="{b.cell} {b.cell}">
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
        aria-label={t('ui.puzzleDialog.island', { n: island.n, count: island.count, selected: String(island.selected) })}>{island.n}</button
      >{/each}
    {#if extra}<span class="toast ok"><span class="toast-check"></span>{t('ui.puzzleDialog.nice')}</span>{/if}
    {#if message}<span class="toast error" role="status">{t(message)}</span>{/if}
  </div>
{/snippet}

<div class="layer" bind:this={layer} class:closing data-screen-label="Daily puzzle" role="dialog" aria-modal="true" aria-label={t('ui.puzzleDialog.label')}>
  <div class="veil" onclick={close} aria-hidden="true"></div>
  <div class="card" class:wide={view === 'play' && wide}>
    <div class="head">
      <span class="badge"><span class="badge-icon"></span></span>
      <span class="heading"
        ><span class="title">{view === 'tutorial' ? t('ui.puzzleDialog.howTitle') : t('ui.puzzleDialog.dailyTitle', { number: '20734' })}</span><span class="subtitle"
          >{view === 'tutorial' ? t('ui.puzzleDialog.tutorialStep', { step: step + 1, total: STEPS.length }) : t('ui.puzzleDialog.gameMeta')}</span
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
            <span class="hint" style:opacity={canHint ? 1 : 0.45} onclick={hint} role="button" tabindex="0" aria-disabled={!canHint}
              ><span class="hint-icon"></span>{t('ui.puzzleDialog.useHint')}<span class="hint-meta">{hints >= HINTS ? t('ui.puzzleDialog.noneLeft') : t('ui.puzzleDialog.hintCost', { cost: HINT_COST, left: HINTS - hints })}</span></span
            >
          </div>
        </div>
      </div>
    {/if}

    {#if view === 'solved'}
      <div class="solved-view">
        <span class="trophy"><span class="trophy-icon"></span></span>
        <span class="solved-heading"><span class="solved-title">{t('ui.puzzleDialog.solvedIn', { time: resultTime })}</span><span class="solved-sub">{t('ui.puzzleDialog.dailyTitle', { number: '20734' })} · {t('ui.puzzleDialog.gameMeta')}</span></span>
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
                onclick={() => {
                  answered = false;
                  onRemind?.(false);
                }}
                role="button"
                tabindex="0">{t('ui.puzzleDialog.notNow')}</span
              >
              <span
                class="ask-yes"
                onclick={() => {
                  answered = true;
                  onRemind?.(true);
                }}
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
          <span
            class="finish-button"
            onclick={() => {
              onShare?.();
              close();
            }}
            role="button"
            tabindex="0"><span class="share-icon"></span>{t('ui.puzzleDialog.share')}</span
          >
          <span class="finish-button" onclick={close} role="button" tabindex="0">{t('ui.common.done')}</span>
        </div>
        <span class="next">{t('ui.puzzleDialog.nextIn', { countdown })}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 74;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22, 22px);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-16, 16px);
    width: 100%;
    max-width: 520px;
    max-height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    padding: var(--space-18, 18px) var(--space-20, 20px) var(--space-20, 20px);
    border-radius: var(--radius-xl, 24px);
    background: var(--surface-1, #101015);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 60px rgba(0, 0, 0, 0.5);
    color: var(--ink, #ececf1);
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .card.wide {
    max-width: 880px;
  }

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10, 10px);
  }

  .badge {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md, 12px);
    background: var(--accent-soft, rgba(255, 86, 114, 0.16));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-icon {
    width: 18px;
    height: 18px;
    background: var(--accent-bright, #ff8298);
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
    font: var(--weight-bold, 700) var(--text-lg, 16px) / 1.1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .subtitle {
    font: var(--weight-medium, 500) var(--text-sm, 12.5px) / 1 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
  }

  .skip {
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--space-10, 10px);
    border-radius: var(--radius-sm, 8px);
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
    cursor: pointer;
  }

  .skip:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink, #ececf1);
  }

  .head-button {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 8px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .head-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .head-glyph {
    background: var(--ink-3, #a3a3b2);
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
    gap: var(--space-16, 16px);
  }

  .play-view {
    gap: var(--space-14, 14px);
  }

  .board {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    container-type: inline-size;
    border-radius: var(--radius-lg, 18px);
    background: var(--surface-2, #191921) radial-gradient(circle, var(--line-2, rgba(255, 255, 255, 0.12)) 1.2px, transparent 1.8px) 0 0;
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
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
    background: var(--ink-2, #c9c9d4);
  }

  .vertical .bridge-line {
    width: 3px;
    height: 100%;
  }

  .over .bridge-line {
    background: var(--status-danger, #ff4d4d);
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
    box-shadow: inset 0 0 0 1.5px var(--line-3, rgba(255, 255, 255, 0.24));
    color: var(--ink, #ececf1);
    font-family: var(--font-sans);
    font-weight: var(--weight-bold, 700);
    line-height: 1;
    cursor: pointer;
    transition:
      background 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out),
      transform 160ms var(--ease-out);
  }

  .island.done {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    box-shadow: none;
  }

  .island.candidate {
    box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--accent, #ff5672) 70%, transparent);
  }

  .island.selected {
    box-shadow:
      0 0 0 4px color-mix(in oklch, var(--accent, #ff5672) 45%, transparent),
      inset 0 0 0 2px var(--accent-bright, #ff8298);
    transform: scale(1.06);
  }

  .island.over {
    box-shadow: inset 0 0 0 2px var(--status-danger, #ff4d4d);
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
    border-radius: var(--radius-pill, 999px);
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
    white-space: nowrap;
  }

  .toast.ok {
    gap: 6px;
    background: var(--status-online, #2ee6a8);
    color: #062a1d;
    font-weight: var(--weight-bold, 700);
  }

  .toast.error {
    background: var(--status-danger, #ff4d4d);
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
    font: var(--weight-bold, 700) var(--text-md, 14px) / 1.2 var(--font-sans);
  }

  .step-body {
    font: var(--weight-regular, 400) var(--text-sm, 13px) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .step-nav {
    display: flex;
    align-items: center;
    gap: var(--space-10, 10px);
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
    background: var(--accent, #ff5672);
  }

  .dot.current {
    width: 22px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    height: 42px;
    padding: 0 var(--space-14, 14px);
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
    cursor: pointer;
  }

  .nav-button:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .nav-button.primary {
    padding: 0 var(--space-18, 18px);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    font-weight: var(--weight-bold, 700);
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
    border-radius: var(--radius-md, 12px);
    background: var(--surface-2, #191921);
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
  }

  .stat.streak {
    color: var(--status-chit, #ff9f45);
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
    color: var(--ink-2, #c9c9d4);
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
    gap: var(--space-14, 14px);
    min-width: 0;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: var(--radius-md, 14px);
    background: var(--surface-2, #191921);
  }

  .progress-head {
    display: flex;
    justify-content: space-between;
    font: var(--weight-semibold, 600) var(--text-sm, 12.5px) / 1 var(--font-sans);
  }

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }

  .progress-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent, #ff5672);
    transition: width 240ms var(--ease-out);
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: 9px;
    font: var(--weight-regular, 400) var(--text-sm, 13px) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .rules-title {
    font: var(--weight-semibold, 600) var(--text-xs, 12px) / 1 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
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
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: center;
    font: var(--weight-bold, 700) 10.5px/1 var(--font-mono);
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
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold, 600) var(--text-sm, 13px) / 1 var(--font-sans);
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
    border-radius: var(--radius-md, 12px);
    background: color-mix(in oklch, var(--status-chit, #ff9f45) 16%, var(--surface-2, #191921));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-chit, #ff9f45) 35%, transparent);
    font: var(--weight-semibold, 600) var(--text-sm, 13.5px) / 1 var(--font-sans);
    cursor: pointer;
  }

  .hint:hover {
    filter: brightness(1.12);
  }

  .hint-icon {
    width: 15px;
    height: 15px;
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-spark) center/contain no-repeat;
  }

  .hint-meta {
    font: var(--weight-medium, 500) var(--text-xs, 12px) / 1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .solved-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-16, 16px);
    text-align: center;
    padding-top: var(--space-6, 6px);
  }

  .trophy {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: var(--accent-soft, rgba(255, 86, 114, 0.18));
    display: flex;
    align-items: center;
    justify-content: center;
    animation: oc-pz-pop 420ms var(--ease-out) both;
  }

  .trophy-icon {
    width: 30px;
    height: 30px;
    background: var(--accent-bright, #ff8298);
    mask: var(--icon-trophy) center/contain no-repeat;
  }

  .solved-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .solved-title {
    font: var(--weight-bold, 700) 22px/1.1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .solved-sub {
    font: var(--weight-medium, 500) var(--text-sm, 13px) / 1 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
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
    border-radius: var(--radius-md, 12px);
    background: var(--surface-2, #191921);
  }

  .result-value {
    font: var(--weight-bold, 700) 17px/1 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .result-value.chit {
    color: var(--status-chit, #ff9f45);
  }

  .result-label {
    font: var(--weight-medium, 500) var(--text-xs, 11.5px) / 1 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
  }

  .ask {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-12, 12px);
    padding: 12px;
    border-radius: var(--radius-lg, 16px);
    background: var(--surface-2, #191921);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 35%, transparent);
    text-align: start;
  }

  .ask-icon {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bell {
    width: 17px;
    height: 17px;
    background: var(--ink, #ececf1);
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
    font: var(--weight-semibold, 600) var(--text-md, 13.5px) / 1.2 var(--font-sans);
  }

  .ask-sub {
    font: var(--weight-medium, 500) var(--text-xs, 12px) / 1.35 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
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
    border-radius: var(--radius-sm, 10px);
    font: var(--weight-semibold, 600) var(--text-sm, 12.5px) / 1 var(--font-sans);
    cursor: pointer;
  }

  .ask-no {
    color: var(--ink-2, #c9c9d4);
  }

  .ask-no:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .ask-yes {
    padding: 0 14px;
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    font-weight: var(--weight-bold, 700);
  }

  .ask-yes:hover {
    filter: brightness(1.08);
  }

  .remind-note {
    display: flex;
    align-items: center;
    gap: 7px;
    font: var(--weight-medium, 500) var(--text-sm, 12.5px) / 1.3 var(--font-sans);
    color: var(--ink-3, #a3a3b2);
  }

  .remind-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3, #a3a3b2);
    mask: var(--icon-info) center/contain no-repeat;
  }

  .remind-icon.on {
    background: var(--status-online, #2ee6a8);
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
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold, 600) var(--text-sm, 13.5px) / 1 var(--font-sans);
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
    font: var(--weight-medium, 500) var(--text-xs, 12px) / 1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }
</style>
