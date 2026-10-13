<!-- Multi-step progress for on-chain flows. Phases group technical steps so 5–7 steps read as 3.
     A phase's state is derived from its steps when omitted. Sub-steps show only on the active/failed phase (or when expanded).
     collapseDone: once everything is done, fold into "N steps done · View details". density "compact" tightens rows. -->
<script lang="ts">
  type StepState = 'done' | 'active' | 'todo' | 'failed';

  interface Phase {
    title: string;
    sub?: string;
    /** Replaces sub while the phase is failed. */
    error?: string;
    state?: StepState;
    steps?: { label: string; state?: StepState }[];
  }

  interface Props {
    phases: Phase[];
    density?: 'regular' | 'compact';
    collapseDone?: boolean;
  }

  let { phases, density = 'regular', collapseDone = false }: Props = $props();

  let expanded = $state(false);

  function derive(ph: Phase): StepState {
    if (ph.state) return ph.state;
    const ss = (ph.steps ?? []).map((s) => s.state);
    if (ss.includes('failed')) return 'failed';
    if (ss.length && ss.every((s) => s === 'done')) return 'done';
    if (ss.some((s) => s === 'active' || s === 'done')) return 'active';
    return 'todo';
  }

  const states = $derived(phases.map(derive));
  const allDone = $derived(states.length > 0 && states.every((s) => s === 'done'));
  const totalSteps = $derived(phases.reduce((n, ph) => n + Math.max(1, (ph.steps ?? []).length), 0));
  const collapsed = $derived(collapseDone && allDone && !expanded);
</script>

<div class="timeline" class:compact={density === 'compact'} role="list">
  {#if collapsed}
    <div class="summary" role="listitem">
      <span class="node done"><span class="mark"></span></span>
      <span class="summary-text">{totalSteps} steps done</span>
      <span class="link" onclick={() => (expanded = !expanded)} role="button" tabindex="0" aria-expanded={expanded}>View details</span>
    </div>
  {:else}
    {#each phases as ph, i}
      {@const st = states[i]}
      {@const open = st === 'active' || st === 'failed' || (expanded && allDone)}
      {@const sub = st === 'failed' ? ph.error || ph.sub || '' : ph.sub || ''}
      <div class="phase {st}" role="listitem">
        <div class="rail">
          <span class="node {st}"><span class="mark"></span></span>
          <span class="line" class:last={i === phases.length - 1}></span>
        </div>
        <div class="body">
          <span class="title">{ph.title}</span>
          {#if sub && (st !== 'done' || expanded)}<span class="sub">{sub}</span>{/if}
          {#if open && ph.steps?.length}
            <div class="steps">
              {#each ph.steps as step}<div class="step {step.state ?? 'todo'}"><span class="step-slot"><span class="step-mark"></span></span><span class="step-label">{step.label}</span></div>{/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
    {#if collapseDone && allDone && expanded}<span class="link hide" onclick={() => (expanded = !expanded)} role="button" tabindex="0">Hide details</span>{/if}
  {/if}
</div>

<style>
  .timeline {
    --node: 28px;
    --gap-min: 18px;
    --row-pad: 5px 0 18px;
    display: flex;
    flex-direction: column;
  }

  .compact {
    --node: 24px;
    --gap-min: 12px;
    --row-pad: 3px 0 12px;
  }

  .summary {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }

  .summary-text {
    flex: 1;
    min-width: 0;
    font: 600 14px/1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .link {
    flex: none;
    font: 600 13px/1 var(--font-sans);
    color: var(--accent-bright, #ff8298);
    cursor: pointer;
    user-select: none;
  }

  .hide {
    align-self: flex-start;
    margin: 2px 0 0 42px;
  }

  .phase {
    display: flex;
    gap: 14px;
  }

  .rail {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .node {
    flex: none;
    width: var(--node);
    height: var(--node);
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .mark {
    width: 12px;
    height: 12px;
    background: var(--ink-5, #6e6e7c);
    mask: var(--icon-dot-heavy) center/contain no-repeat;
  }

  .node.done {
    background: rgba(46, 230, 168, 0.14);
  }

  .node.done .mark {
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .node.failed {
    background: rgba(245, 73, 61, 0.14);
  }

  .node.failed .mark {
    background: var(--status-danger, #f5493d);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .node.active {
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    box-shadow: inset 0 0 0 1.5px var(--accent, #ff5672);
  }

  .node.active .mark {
    background: var(--accent-bright, #ff8298);
  }

  .line {
    flex: 1;
    width: 1px;
    min-height: var(--gap-min);
    background: var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .done .line {
    background: var(--status-online, #2ee6a8);
  }

  .line.last,
  .done .line.last {
    background: transparent;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--row-pad);
  }

  .title {
    font: 600 14px/1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .todo .title {
    color: var(--ink-4, #8a8a99);
  }

  .sub {
    font: 400 12.5px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .failed .sub {
    color: var(--status-danger, #f5493d);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding-top: 4px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .step-slot {
    flex: none;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step-mark {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: transparent;
  }

  .step.todo .step-mark {
    box-shadow: inset 0 0 0 1.5px var(--line-3, rgba(255, 255, 255, 0.24));
  }

  .step.active .step-mark {
    background: var(--accent, #ff5672);
  }

  .step.done .step-mark,
  .step.failed .step-mark {
    width: 13px;
    height: 13px;
  }

  .step.done .step-mark {
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .step.failed .step-mark {
    background: var(--status-danger, #f5493d);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .step-label {
    min-width: 0;
    font: 400 13px/1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .step.active .step-label {
    font-weight: 600;
  }

  .step.todo .step-label {
    color: var(--ink-4, #8a8a99);
  }

  .step.failed .step-label {
    color: var(--status-danger, #f5493d);
  }
</style>
