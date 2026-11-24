<!-- The PIN sheet's pad (native design notes §3.9 PIN sheet): a row of dots, one per digit, filled in the accent as
     digits go in, over a 3 × 4 keypad (1–9, then 0 with delete beside it). The keyboard's digits and Backspace work
     too while it's shown. The digits are the host's (`value`): a key reports the next value (pinPad.ts), and the last
     digit `onComplete`. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import { PIN_KEYS, pinDots, pinKeyOf, pinPress, type PinKey } from './pinPad';

  interface Props {
    /** The digits so far. */
    value: string;
    /** How many digits. */
    length?: number;
    /** Resource key (or literal text): the dots' accessible name. */
    label?: string;
    /** Resource key (or literal text): the delete key's accessible name. */
    deleteLabel?: string;
    /** Keys ignored (the PIN is on its way). */
    disabled?: boolean;
    onInput: (value: string) => void;
    /** The last digit is in. */
    onComplete?: (value: string) => void;
  }

  let {
    value,
    length = 6,
    label = 'ui.native.pinPad.label',
    deleteLabel = 'ui.native.pinPad.delete',
    disabled = false,
    onInput,
    onComplete,
  }: Props = $props();
  const t = useT();

  const dots = $derived(pinDots(value, length));

  function press(key: PinKey) {
    if (disabled) return;
    const next = pinPress(value, key, length);
    if (next === value) return;
    onInput(next);
    if (next.length === length) onComplete?.(next);
  }

  function keydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = pinKeyOf(e.key);
    if (key === undefined) return;
    e.preventDefault();
    press(key);
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="pin-pad">
  <div class="dots" role="img" aria-label={`${t(label)}: ${value.length} / ${length}`}>
    {#each dots as filled, i (i)}
      <span class="dot" class:filled></span>
    {/each}
  </div>
  <div class="keys">
    {#each PIN_KEYS as key, i (i)}
      {#if key === null}
        <span class="gap"></span>
      {:else if key === 'delete'}
        <button type="button" class="key delete" aria-label={t(deleteLabel)} onclick={() => press(key)}>
          <span class="delete-icon"></span>
        </button>
      {:else}
        <button type="button" class="key digit" onclick={() => press(key)}>{key}</button>
      {/if}
    {/each}
  </div>
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .pin-pad {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }

  .dots {
    display: flex;
    gap: 14px;
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--ink-4);
    transition: background-color 0.12s;

    &.filled {
      background: var(--accent);
      box-shadow: none;
    }
  }

  .keys {
    align-self: stretch;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 0 12px;
  }

  .key {
    height: 60px;
    @include flex-center;
    border: 0;
    border-radius: 16px;
    background: none;
    color: var(--ink);
    font: var(--weight-semibold) text-size(24px) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: var(--overlay-2);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .digit {
    background: var(--overlay-1);
  }

  .delete-icon {
    width: 24px;
    height: 24px;
    background: var(--ink-2);
    mask: var(--icon-back) center / contain no-repeat;
  }

  @include reduced-motion {
    .dot {
      transition: none;
    }
  }
</style>
