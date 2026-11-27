<!-- A single-line text field for forms: the library Field's height (--control-xl, 44px) and surface, for typed values
     rather than search. The placeholder says what goes in; a visible label (with something beside it, `aside`) is for
     where it doesn't. `mono` for ids, keys and amounts; `unit` after the value ("e8s"). `paste` and `copy` add the
     clipboard buttons an id field wants. An `error` outlines it and says why under it (and sets aria-invalid);
     otherwise `help` and `note` (a value it comes to, in mono) are under it. `valid` shows a tick once the value is
     checked. Text from the host is resource keys or literal text. -->
<script lang="ts">
  import { copyText } from '../clipboard';
  import { useT } from '../i18n';

  interface Props {
    value?: string;
    /** Resource key (or literal text): what goes in. Also the field's accessible name when it has no label. */
    placeholder?: string;
    /** Resource key (or literal text): a label over the field, for where the placeholder can't say it. */
    label?: string;
    /** Resource key (or literal text): beside the label, at its end (the value now, "Off"). */
    aside?: string;
    /** Resource key (or literal text): the accessible name, when it's neither the label nor the placeholder. */
    ariaLabel?: string;
    /** Resource key (or literal text): under the field. */
    help?: string;
    /** Literal text after the help, in mono: what the value comes to ("15.00 CHAT"). */
    note?: string;
    /** Resource key (or literal text): why the value can't be used. */
    error?: string;
    /** Ids, keys and amounts. */
    mono?: boolean;
    /** After the value ("e8s"). */
    unit?: string;
    type?: 'text' | 'password';
    inputmode?: 'text' | 'numeric' | 'decimal';
    /** A tick at the end: the value is checked and good. */
    valid?: boolean;
    /** A Paste button, which sets the value to what's on the clipboard. */
    paste?: boolean;
    /** A Copy button, while there's a value. */
    copy?: boolean;
    disabled?: boolean;
    id?: string;
    onInput?: (value: string) => void;
  }

  let {
    value = '',
    placeholder = '',
    label = '',
    aside = '',
    ariaLabel = '',
    help = '',
    note = '',
    error = '',
    mono = false,
    unit = '',
    type = 'text',
    inputmode = 'text',
    valid = false,
    paste = false,
    copy = false,
    disabled = false,
    id,
    onInput,
  }: Props = $props();
  const t = useT();

  const uid = $props.id();
  const inputId = $derived(id ?? `text-input-${uid}`);
  const noteId = $derived(`${inputId}-note`);
  const name = $derived(t(ariaLabel || label || placeholder));
  let copied = $state(false);

  async function pasteIn() {
    try {
      const text = await navigator.clipboard.readText();
      onInput?.(text.trim());
    } catch {
      // nothing on the clipboard we may read: the field keeps its value
    }
  }

  async function copyOut() {
    copied = await copyText(value);
    if (copied) setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="text-input" class:mono>
  {#if label}
    <div class="top">
      <label class="label" for={inputId}>{t(label)}</label>
      {#if aside}<span class="aside">{t(aside)}</span>{/if}
    </div>
  {/if}
  <div class="box" class:invalid={!!error} class:disabled>
    <input
      id={inputId}
      {type}
      {value}
      {inputmode}
      {disabled}
      placeholder={t(placeholder)}
      aria-label={label ? undefined : name}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error || help || note ? noteId : undefined}
      autocomplete="off"
      spellcheck="false"
      oninput={(e) => onInput?.(e.currentTarget.value)} />
    {#if valid && !error}<span class="tick" aria-hidden="true"></span>{/if}
    {#if unit}<span class="unit">{unit}</span>{/if}
    {#if paste && !disabled}
      <button type="button" class="tool" onclick={pasteIn} aria-label={`${t('ui.textInput.paste')}: ${name}`}>
        <span class="tool-icon paste"></span>{t('ui.textInput.paste')}
      </button>
    {/if}
    {#if copy && value}
      <button type="button" class="tool" onclick={copyOut} aria-label={`${t(copied ? 'ui.common.copied' : 'ui.common.copy')}: ${name}`}>
        <span class="tool-icon" class:copied></span>
      </button>
    {/if}
  </div>
  {#if error}
    <span class="error" id={noteId} role="alert"><span class="error-icon"></span>{t(error)}</span>
  {:else if help || note}
    <span class="help" id={noteId}>{t(help)}{#if note}{help ? ' ' : ''}<span class="note">{note}</span>{/if}</span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .text-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: baseline;
    gap: var(--space-8);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-2);
  }

  .aside {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .box {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: var(--control-xl);
    box-sizing: border-box;
    padding: 0 var(--space-8) 0 var(--space-14);
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
    transition: box-shadow var(--duration-fast) var(--ease-out);

    &:focus-within {
      box-shadow: inset 0 0 0 1.5px var(--accent);
    }

    &.invalid {
      box-shadow: inset 0 0 0 1.5px var(--status-danger);
    }

    &.disabled {
      opacity: 0.6;
    }
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: none;
    font: var(--weight-regular) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);

    &::placeholder {
      color: var(--ink-4);
    }

    .mono & {
      font: var(--weight-medium) var(--text-md) / 1.2 var(--font-mono);
    }
  }

  .tick {
    @include icon(check, 14px, var(--status-online));
  }

  .unit {
    flex: none;
    padding: 0 var(--space-6);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .tool {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    height: 30px;
    padding: 0 var(--space-8);
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;

    &:hover {
      background: var(--overlay-3);
      color: var(--ink);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .tool-icon {
    @include icon(copy, 12px);

    &.paste {
      mask-image: var(--icon-paste);
    }

    &.copied {
      mask-image: var(--icon-check);
    }
  }

  .help {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3);
  }

  .note {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .error {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .error-icon {
    @include icon(warning, 13px, var(--status-danger));
  }
</style>
