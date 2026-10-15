<!-- Multi-step progress for on-chain flows: every step always visible (no collapsing). A done step can show how long it
     took (meta, e.g. "0:04"), the active one reads "now" and shows its hint, a failed one shows its error.
     showBar (default true) puts a "Step 2 of 5" bar above the list, with `elapsed` on its right; `funds` is one line saying
     where the user's money is right now. density "compact" tightens rows.
     The older grouped `phases` input is flattened into steps (a phase's sub becomes its steps' hint, its error the failed
     step's error); `steps` wins when both are given. -->
<script lang="ts" module>
  export type TimelineState = 'done' | 'active' | 'todo' | 'failed';

  /** label, hint and error: resource keys (or literal text). */
  export interface TimelineStep {
    label: string;
    state: TimelineState;
    /** Shown under the step while it's active (and under a failed one without an error). */
    hint?: string;
    /** Shown under the step when it failed. */
    error?: string;
    /** Right of a done step, e.g. how long it took ("0:04"). */
    meta?: string;
  }

  /** Where the user's money is right now: text is a resource key (or literal text). */
  export interface TimelineFunds {
    text: string;
    tone: 'active' | 'done' | 'warn';
  }

  /** Legacy grouped input: title, sub, error and step labels are resource keys (or literal text). */
  export interface TimelinePhase {
    title: string;
    sub?: string;
    error?: string;
    state?: TimelineState;
    steps?: { label: string; state?: TimelineState; hint?: string; error?: string }[];
  }
</script>

<script lang="ts">
  import { useT } from '../i18n';
  import Spinner from './Spinner.svelte';

  interface Props {
    /** Every step, in order. */
    steps?: TimelineStep[];
    /** One line saying where the user's money is; hidden when omitted. */
    funds?: TimelineFunds | null;
    /** The "Step N of M" bar above the list. */
    showBar?: boolean;
    /** Right of the bar, e.g. "0:12" or "Took 0:24". */
    elapsed?: string;
    density?: 'regular' | 'compact';
    /** Older grouped input, flattened into steps; ignored when `steps` is given. */
    phases?: TimelinePhase[];
  }

  let { steps, funds = null, showBar = true, elapsed = '', density = 'regular', phases = [] }: Props = $props();
  const t = useT();

  const FUNDS_ICON = { active: 'wallet-send', done: 'wallet', warn: 'shield' } as const;

  const list = $derived.by((): TimelineStep[] => {
    if (steps?.length) return steps;
    return phases.flatMap((ph) => {
      const ss: NonNullable<TimelinePhase['steps']> = ph.steps?.length ? ph.steps : [{ label: ph.title, state: ph.state }];
      return ss.map((s) => ({ label: s.label, state: s.state ?? 'todo', hint: s.hint ?? ph.sub, error: s.error ?? ph.error }));
    });
  });

  const total = $derived(list.length);
  const doneCount = $derived(list.filter((s) => s.state === 'done').length);
  const failedAt = $derived(list.findIndex((s) => s.state === 'failed'));
  const activeAt = $derived(list.findIndex((s) => s.state === 'active'));
  const allDone = $derived(total > 0 && doneCount === total);
  const stepOf = $derived(
    allDone
      ? t('ui.progressTimeline.allDone', { total })
      : failedAt >= 0
        ? t('ui.progressTimeline.stoppedAt', { step: failedAt + 1, total })
        : t('ui.progressTimeline.stepOf', { step: Math.max(1, (activeAt >= 0 ? activeAt : doneCount) + 1), total }),
  );
  // the active step counts as part-way, a failed one as reached
  const pct = $derived(total ? (allDone ? 100 : Math.max(4, ((doneCount + (activeAt >= 0 ? 0.4 : 0) + (failedAt >= 0 ? 1 : 0)) / total) * 100)) : 0);
  const barTone = $derived(allDone ? 'done' : failedAt >= 0 ? 'failed' : 'active');
</script>

<div class="timeline" class:compact={density === 'compact'}>
  {#if showBar && total > 0}
    <div class="bar-block">
      <div class="bar-text"><span>{stepOf}</span><span>{t(elapsed)}</span></div>
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label={stepOf}>
        <div class="bar-fill {barTone}" style:width="{pct.toFixed(1)}%"></div>
      </div>
    </div>
  {/if}
  {#if funds?.text}
    <div class="funds {funds.tone}" role="status">
      <span class="funds-badge"><span class="funds-icon" style:mask="var(--icon-{FUNDS_ICON[funds.tone] ?? FUNDS_ICON.active}) center/contain no-repeat"></span></span>
      <span class="funds-text">{t(funds.text)}</span>
    </div>
  {/if}
  <div class="steps" role="list">
    {#each list as s, k}
      {@const note = s.state === 'failed' ? s.error || s.hint : s.state === 'active' ? s.hint : ''}
      <div class="step {s.state}" role="listitem" aria-current={s.state === 'active' ? 'step' : undefined}>
        <div class="rail">
          <span class="dot">
            {#if s.state === 'done'}<span class="mark check"></span>
            {:else if s.state === 'failed'}<span class="mark cross"></span>
            {:else if s.state === 'active'}<Spinner size={14} tone="accent" />
            {:else}<span class="num">{k + 1}</span>{/if}
          </span>
          <span class="line" class:last={k === total - 1}></span>
        </div>
        <div class="body">
          <div class="head">
            <span class="label">{t(s.label)}</span>
            <span class="meta">{s.state === 'done' ? t(s.meta ?? '') : s.state === 'active' ? t('ui.progressTimeline.now') : ''}</span>
          </div>
          {#if note}<span class="note">{t(note)}</span>{/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .timeline {
    --dot: 26px;
    --row-pad: 4px 0 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .compact {
    --dot: 24px;
    --row-pad: 3px 0 14px;
  }

  .bar-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bar-text {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent, #ff5672);
    transition:
      width 0.4s var(--ease-out, ease-out),
      background 0.2s;
  }

  .bar-fill.done {
    background: var(--status-online, #2ee6a8);
  }

  .bar-fill.failed {
    background: var(--status-danger, #f5493d);
  }

  .funds {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    border-radius: 12px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .funds-badge {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
  }

  .funds-icon {
    width: 14px;
    height: 14px;
    background: var(--accent-bright, #ff8298);
  }

  .funds.done .funds-badge {
    background: rgba(46, 230, 168, 0.14);
  }

  .funds.done .funds-icon {
    background: var(--status-online, #2ee6a8);
  }

  .funds.warn .funds-badge {
    background: rgba(255, 176, 61, 0.16);
  }

  .funds.warn .funds-icon {
    background: var(--status-warning, #ffb03d);
  }

  .funds-text {
    flex: 1;
    min-width: 0;
    font: 600 13px/1.35 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .steps {
    display: flex;
    flex-direction: column;
  }

  .step {
    display: flex;
    gap: 12px;
  }

  .rail {
    flex: none;
    width: var(--dot);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dot {
    flex: none;
    width: var(--dot);
    height: var(--dot);
    box-sizing: border-box;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 600 11px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
    box-shadow: inset 0 0 0 1.5px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .done .dot {
    background: rgba(46, 230, 168, 0.14);
    box-shadow: none;
  }

  .failed .dot {
    background: rgba(245, 73, 61, 0.14);
    box-shadow: none;
  }

  .active .dot {
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    box-shadow: inset 0 0 0 1.5px var(--accent, #ff5672);
  }

  .mark.check {
    width: 12px;
    height: 12px;
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .mark.cross {
    width: 11px;
    height: 11px;
    background: var(--status-danger, #f5493d);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .line {
    flex: 1;
    width: 2px;
    min-height: 10px;
    margin: 3px 0;
    border-radius: 1px;
    background: var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .done .line {
    background: var(--status-online, #2ee6a8);
  }

  .line.last {
    opacity: 0;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--row-pad);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .label {
    flex: 1;
    min-width: 0;
    font: 600 13.5px/1.35 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .todo .label {
    color: var(--ink-4, #8a8a99);
  }

  .meta {
    flex: none;
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .note {
    font: 400 12px/1.45 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .failed .note {
    color: var(--status-danger, #f5493d);
  }
</style>
