<!-- Search field. With onInput it is a live text input (plus a clear button once there is text and onClear is set);
     without, it stays the static placeholder chip used in the library. Optional help line aligns with the text. -->
<script lang="ts">
  import { useT } from '../i18n';
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
</script>

<div class="field">
  <div class="box">
    {#if showIcon}
      <span class="search-icon"></span>
    {/if}
    {#if live}
      <input {value} oninput={onInput} placeholder={t(placeholder)} />
    {:else}
      <span class="placeholder">{t(placeholder)}</span>
    {/if}
    {#if showClear}
      <span class="clear" onclick={onClear} role="button" tabindex="0" aria-label={t('ui.field.clear')}>
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

<style>
  .field {
    width: 100%;
  }

  .box {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: var(--control-xl, 44px);
    box-sizing: border-box;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.05));
  }

  .search-icon {
    width: 15px;
    height: 15px;
    flex: none;
    background: var(--ink-4, #6e6e7c);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .placeholder {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-4, #63636f);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-regular) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .clear {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    cursor: pointer;
  }

  .clear:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .clear-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .shortcut {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #63636f);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
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
    color: var(--ink-3, #8a8a99);
    text-wrap: pretty;
  }
</style>
