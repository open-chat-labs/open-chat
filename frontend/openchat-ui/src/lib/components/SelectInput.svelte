<!-- A choice of a few values for forms, as TextInput looks (44px, the field surface, a chevron at the end): the browser's
     own select underneath, so its list, keyboard and screen reader behaviour are the platform's. The options' labels
     say what they are ("Game: as scheduled") where there's no label over it. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    value: string;
    /** Each option's value and its label (resource key or literal text). */
    options: { value: string; label: string }[];
    /** Resource key (or literal text): a label over the field. */
    label?: string;
    /** Resource key (or literal text): the accessible name without a label. */
    ariaLabel?: string;
    /** Resource key (or literal text): under the field. */
    help?: string;
    /** Ids and keys. */
    mono?: boolean;
    disabled?: boolean;
    id?: string;
    onChange?: (value: string) => void;
  }

  let { value, options, label = '', ariaLabel = '', help = '', mono = false, disabled = false, id, onChange }: Props = $props();
  const t = useT();

  const uid = $props.id();
  const selectId = $derived(id ?? `select-input-${uid}`);
</script>

<div class="select-input" class:mono>
  {#if label}<label class="label" for={selectId}>{t(label)}</label>{/if}
  <div class="box" class:disabled>
    <select
      id={selectId}
      {value}
      {disabled}
      aria-label={label ? undefined : t(ariaLabel)}
      aria-describedby={help ? `${selectId}-help` : undefined}
      onchange={(e) => onChange?.(e.currentTarget.value)}>
      {#each options as option (option.value)}
        <option value={option.value}>{t(option.label)}</option>
      {/each}
    </select>
    <span class="chevron" aria-hidden="true"></span>
  </div>
  {#if help}<span class="help" id={`${selectId}-help`}>{t(help)}</span>{/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .select-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .label {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-2);
  }

  .box {
    position: relative;
    display: flex;
    align-items: center;
    height: var(--control-xl);
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);

    &:focus-within {
      box-shadow: inset 0 0 0 1.5px var(--accent);
    }

    &.disabled {
      opacity: 0.6;
    }
  }

  select {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 var(--space-32) 0 var(--space-14);
    border: 0;
    outline: none;
    background: none;
    appearance: none;
    font: var(--weight-regular) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
    cursor: pointer;

    .mono & {
      font: var(--weight-medium) var(--text-md) / 1.2 var(--font-mono);
    }

    option {
      background: var(--surface-2);
      color: var(--ink);
    }
  }

  .chevron {
    position: absolute;
    inset-inline-end: var(--space-14);
    pointer-events: none;
    @include icon(chevron-down, 14px, var(--ink-3));
  }

  .help {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3);
  }
</style>
