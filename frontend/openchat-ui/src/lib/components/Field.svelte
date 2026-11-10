<!-- Search field. With onInput it is a live text input (plus a clear button once there is text and onClear is set);
     without, it stays the static placeholder chip used in the library. Optional help line aligns with the text.
     The live input reads as a search, so password managers and the platform's autofill leave it alone
     (SEARCH_INPUT_ATTRIBUTES), and clearing it keeps its focus (and a phone's keyboard). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { SEARCH_INPUT_ATTRIBUTES } from '../searchInput';
  interface Props {
    /** Resource key (or literal text). */
    placeholder: string;
    value?: string;
    onInput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onClear?: () => void;
    shortcut?: string;
    showIcon?: boolean;
    /** Defaults to on for the static chip, off for a live input. */
    showShortcut?: boolean;
    /** Resource key (or literal text). */
    help?: string;
  }

  let { placeholder, value = '', onInput, onClear, shortcut = '⌘K', showIcon = true, showShortcut, help = '' }: Props = $props();
  const t = useT();

  const live = $derived(typeof onInput === 'function');
  const showClear = $derived(live && value.length > 0 && typeof onClear === 'function');

  let input = $state<HTMLInputElement>();

  function clear() {
    onClear?.();
    input?.focus();
  }

  function clearKey(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    clear();
  }
</script>

<div class="field">
  <div class="box">
    {#if showIcon}
      <span class="search-icon"></span>
    {/if}
    {#if live}
      <input bind:this={input} {...SEARCH_INPUT_ATTRIBUTES} {value} oninput={onInput} placeholder={t(placeholder)} aria-label={t(placeholder)} />
    {:else}
      <span class="placeholder">{t(placeholder)}</span>
    {/if}
    {#if showClear}
      <!-- a tap mustn't take the focus from the input (a phone's keyboard would close) -->
      <span class="clear" onpointerdown={(e) => e.preventDefault()} onclick={clear} onkeydown={clearKey} role="button" tabindex="0" aria-label={t('ui.field.clear')}>
        <span class="clear-icon"></span>
      </span>
    {/if}
    {#if (showShortcut ?? !live) && shortcut && !showClear}
      <span class="shortcut">{shortcut}</span>
    {/if}
  </div>
  {#if help}
    <div class="help">
      {#if showIcon}
        <span class="indent"></span>
      {/if}
      <span class="help-text">{t(help)}</span>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .field {
    width: 100%;
  }

  .box {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: var(--control-xl);
    box-sizing: border-box;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .search-icon {
    @include icon(search, 15px, var(--ink-4));
  }

  .placeholder {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-4);
    @include truncate;
  }

  input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-regular) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
    appearance: none;

    // a search input's own clear button: the field draws its own
    &::-webkit-search-cancel-button,
    &::-webkit-search-decoration {
      display: none;
    }
  }

  .clear {
    flex: none;
    @include flex-center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    cursor: pointer;

    &:hover {
      background: var(--btn-hover);
    }
  }

  .clear-icon {
    @include icon(close, 11px, var(--ink-3), $flex: null);
  }

  .shortcut {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
    box-shadow: inset 0 0 0 1px var(--line-2);
    border-radius: var(--radius-xs);
    padding: var(--space-4) var(--space-4);
  }

  .help {
    display: flex;
    margin-top: 7px;
    padding-inline-start: var(--space-12);
  }

  .indent {
    flex: none;
    inline-size: 23px;
  }

  .help-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }
</style>
