<!-- Title, hint and a wrap of duration chips (one selected). `branch` draws the elbow connector that hangs it off a Toggle row above. -->
<script lang="ts">
  import { durationText, useT } from '../i18n';
  const DURATIONS = ['1 hour', '12 hours', '1 day', '1 week', '2 weeks', '1 month', '3 months', '6 months'];

  interface Props {
    /** One of `options`: an id like '12 hours' (shown translated) or a resource key. */
    value: string;
    options?: string[];
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text). */
    hint?: string;
    branch?: boolean;
    onChange?: (value: string) => void;
  }

  let { value, options, title, hint, branch = true, onChange }: Props = $props();
  const t = useT();

  const list = $derived(options?.length ? options : DURATIONS);
</script>

<div class="chips" class:branch>
  {#if branch}
    <span class="elbow"></span>
  {/if}
  <div class="head inset">
    <span class="title">{t(title)}</span>
    {#if hint}<span class="hint">{t(hint)}</span>{/if}
  </div>
  <div class="options inset">
    {#each list as label}
      <span class="chip" class:selected={label === value} onclick={() => onChange?.(label)} role="button" tabindex="0">{durationText(t, label)}</span>
    {/each}
  </div>
</div>

<style>
  .chips {
    --oc-trunk: var(--space-22);
    --oc-stub: var(--space-10);
    --oc-clear: var(--space-8);
    --oc-rise: var(--space-14);
    position: relative;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    min-width: 0;
    padding-top: var(--space-8);
  }

  .elbow {
    position: absolute;
    inset-inline-start: var(--oc-trunk);
    top: calc(var(--oc-rise) * -1);
    width: var(--oc-stub);
    height: calc(var(--oc-rise) + var(--space-16));
    border-inline-start: 1px solid var(--line-2, rgba(255, 255, 255, 0.14));
    border-block-end: 1px solid var(--line-2, rgba(255, 255, 255, 0.14));
    border-end-start-radius: var(--radius-sm);
    pointer-events: none;
  }

  /* with the elbow connector the content clears it; standalone it sits flush */
  .inset {
    padding-inline-start: var(--space-4);
    padding-inline-end: var(--space-16);
  }

  .branch .inset {
    padding-inline-start: calc(var(--oc-trunk) + var(--oc-stub) + var(--oc-clear));
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8) var(--space-6);
  }

  .chip {
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    cursor: pointer;
    user-select: none;
  }

  .chip.selected {
    background: var(--accent-soft, rgba(255, 86, 114, 0.14));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.45));
    color: var(--accent-bright, #ff8298);
  }
</style>
