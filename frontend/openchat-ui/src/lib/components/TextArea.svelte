<!-- Multi-line field that grows with its content. Optional character countdown (warns near the limit), help line,
     and an error state that swaps the help for errorText with an alert icon. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    value?: string;
    /** Resource key (or literal text). */
    placeholder?: string;
    /** Resource key (or literal text). */
    help?: string;
    maxLength?: number;
    /** px */
    minHeight?: number;
    error?: boolean;
    /** Resource key (or literal text). */
    errorText?: string;
    onInput?: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
  }

  let { value = '', placeholder = '', help = '', maxLength, minHeight = 76, error = false, errorText = '', onInput }: Props = $props();
  const t = useT();

  let area: HTMLTextAreaElement;

  const remaining = $derived(maxLength ? maxLength - value.length : 0);
  const low = $derived(!!maxLength && remaining <= Math.max(5, Math.round(maxLength * 0.08)));
  const note = $derived(error ? errorText : help);

  // grows with its content; measured on the node so a keystroke costs one layout
  function fit() {
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, minHeight)}px`;
  }

  $effect(() => {
    void value;
    void minHeight;
    fit();
  });
</script>

<div class="field">
  <div class="box" class:error>
    <textarea
      bind:this={area}
      style:min-height="{minHeight}px"
      {value}
      oninput={(e) => {
        onInput?.(e);
        fit();
      }}
      placeholder={t(placeholder)}
      maxlength={maxLength}
      rows={2}
    ></textarea>
    {#if maxLength}
      <span class="count" class:low>{remaining}</span>
    {/if}
  </div>
  {#if note}
    <div class="note" class:error>
      {#if error}
        <span class="alert"></span>
      {/if}
      <span class="note-text">{t(note)}</span>
    </div>
  {/if}
</div>

<style>
  .field {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .box {
    display: flex;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .box.error {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    overflow: hidden;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-regular) var(--text-md) / 1.65 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .count {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .count.low {
    color: var(--status-warning, #ffb03d);
  }

  .note {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
    padding-inline-start: var(--space-16);
  }

  .alert {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--status-danger, #f5493d);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .note-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .note.error .note-text {
    font-weight: var(--weight-medium);
    color: var(--status-danger, #f5493d);
  }
</style>
