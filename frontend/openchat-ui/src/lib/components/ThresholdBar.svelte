<!-- Two-sided vote bar with threshold lines. yes grows from the left, no from the right (fractions 0–1).
     thresholds: [{ at: 0–1, label, strong }] — strong = auto-accept (triangle), else soft "accepted when time runs out" (chevron). -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Threshold {
    at: number;
    /** Resource key (or literal text). */
    label?: string;
    strong?: boolean;
  }

  interface Props {
    yes: number;
    no: number;
    thresholds?: Threshold[];
    height?: number;
    yesColor?: string;
    noColor?: string;
    /** Resource key (or literal text); defaults to "62% yes, 14% no". */
    label?: string;
  }

  let {
    yes,
    no,
    thresholds = [
      { at: 0.5, label: 'ui.thresholdBar.majority' },
      { at: 0.75, label: 'ui.thresholdBar.immediate', strong: true },
    ],
    height = 8,
    yesColor = 'var(--status-online)',
    noColor = 'var(--status-danger)',
    label,
  }: Props = $props();
  const t = useT();

  const pc = (x: number) => `${(Math.max(0, Math.min(1, x)) * 100).toFixed(2)}%`;
</script>

<div class="threshold-bar">
  <div class="marks">
    {#each thresholds as th}
      <span class={th.strong ? 'strong' : 'soft'} style:left={pc(th.at)} title={th.label ? t(th.label) : ''}></span>
    {/each}
  </div>
  <div
    class="bar"
    style:height="{height}px"
    role="img"
    aria-label={label ? t(label) : t('ui.thresholdBar.summary', { yes: Math.round(yes * 100), no: Math.round(no * 100) })}
  >
    <span class="yes" style:width={pc(yes)} style:background={yesColor}></span>
    <span class="no" style:width={pc(no)} style:background={noColor}></span>
    {#each thresholds as th}
      <span class="line" class:strong={th.strong} style:left={pc(th.at)}></span>
    {/each}
  </div>
</div>

<style>
  .threshold-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .marks {
    position: relative;
    height: 14px;
  }

  .marks .strong {
    position: absolute;
    top: 0;
    width: 0;
    height: 0;
    margin-left: -5px;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--ink);
  }

  .marks .soft {
    position: absolute;
    top: -2px;
    width: 7px;
    height: 7px;
    margin-left: -4.5px;
    box-sizing: border-box;
    border-right: 2px solid var(--ink-2);
    border-bottom: 2px solid var(--ink-2);
    transform: rotate(45deg);
  }

  .bar {
    position: relative;
    margin-top: -6px;
    border-radius: 4px;
    background: var(--overlay-2);
  }

  .yes,
  .no {
    position: absolute;
    top: 0;
    bottom: 0;
    transition: width 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  .yes {
    left: 0;
    border-radius: 4px 0 0 4px;
  }

  .no {
    right: 0;
    border-radius: 0 4px 4px 0;
  }

  .line {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--ink-2);
  }

  .line.strong {
    background: var(--ink);
  }
</style>
