<!-- One-time code tiles (native design notes §3.1, Link to your account): six 68px tiles over one hidden input, so
     the platform's one-time-code autofill, paste and the keyboard all go through a single field. Letters come out as
     capitals, anything but letters and digits is dropped (codeTiles.ts). The next tile is ringed in the accent with a
     blinking caret (steady with reduced motion); a refused code (`error`) rings them all in the warning colour. The
     hint and Paste under it are the host's. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import { codeTiles, normaliseCode } from './codeTiles';

  interface Props {
    /** The code so far. */
    value: string;
    /** How many characters. */
    length?: number;
    /** The code was refused: the tiles turn the warning colour until it changes. */
    error?: boolean;
    /** Resource key (or literal text): the field's accessible name. */
    label?: string;
    /** The code as typed, pasted or autofilled: capitals and digits only, at most `length`. */
    onInput: (code: string) => void;
    /** The code is complete. */
    onComplete?: (code: string) => void;
  }

  let { value, length = 6, error = false, label = 'ui.native.codeTiles.label', onInput, onComplete }: Props = $props();
  const t = useT();

  const code = $derived(normaliseCode(value, length));
  const tiles = $derived(codeTiles(code, length, error));

  function input(e: Event & { currentTarget: HTMLInputElement }) {
    const next = normaliseCode(e.currentTarget.value, length);
    if (e.currentTarget.value !== next) e.currentTarget.value = next;
    onInput(next);
    if (next.length === length) onComplete?.(next);
  }
</script>

<label class="code-tiles" style:--tiles={length}>
  <input
    class="input"
    value={code}
    oninput={input}
    autocapitalize="characters"
    autocomplete="one-time-code"
    autocorrect="off"
    spellcheck="false"
    aria-label={t(label)}
    aria-invalid={error || undefined}
  />
  {#each tiles as tile, i (i)}
    <span class="tile {tile.state}" aria-hidden="true">{tile.char}{#if tile.caret}<span class="caret"></span>{/if}</span>
  {/each}
</label>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .code-tiles {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tiles), minmax(0, 1fr));
    gap: 8px;
    cursor: text;
  }

  // the field the tiles stand for: invisible over them, so a tap anywhere focuses it. 16px, or iOS zooms in on focus.
  // No maxlength: a pasted or autofilled code may carry spaces or a dash, which normaliseCode drops before it cuts.
  .input {
    position: absolute;
    inset: 0;
    width: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    font-size: 16px;
    caret-color: transparent;
  }

  .tile {
    height: 68px;
    @include flex-center;
    border-radius: 14px;
    background: var(--overlay-1);
    font: var(--weight-bold) text-size(28px) / 1 var(--font-mono);
    color: var(--ink);
    transition: box-shadow 0.15s;

    &.current {
      box-shadow: inset 0 0 0 1.5px var(--accent);
    }

    &.filled {
      box-shadow: inset 0 0 0 1px var(--line-2);
    }

    &.error {
      box-shadow: inset 0 0 0 1.5px var(--status-warning);
    }
  }

  .caret {
    width: 2px;
    height: 28px;
    background: var(--accent);
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @include reduced-motion {
    .tile {
      transition: none;
    }

    .caret {
      animation: none;
    }
  }
</style>
