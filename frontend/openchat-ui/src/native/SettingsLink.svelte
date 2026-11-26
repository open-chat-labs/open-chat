<!-- Settings row that opens something: a pushed screen (a chevron right) or, as SettingsValue uses it, a value menu (a
     chevron down). An optional icon, the label with optional help, and the current value at the end. At least 60px. -->
<script lang="ts">
  import { useT } from '../lib/i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text). */
    help?: string;
    /** Resource key (or literal text): the current value, at the end ("Saved", "Kai Moreno"). */
    value?: string;
    /** An icons.js name, before the label (the You tab's lists). */
    icon?: string;
    /** right: opens a screen. down: opens a menu of values. */
    chevron?: 'right' | 'down';
    /** The value in the accent: a setting changed from its default. */
    accent?: boolean;
    /** The value quieter (`--ink-4`): nothing set (None, Off, Default). */
    quiet?: boolean;
    /** The icon in the accent: the thing the row sets is on (Access gates' list). */
    iconAccent?: boolean;
    /** The help as a one-line summary (`--ink-2`, clipped) rather than a description. */
    helpSummary?: boolean;
    /** Dimmed and not pressable: the setting doesn't apply yet. */
    disabled?: boolean;
    /** Shown, not changeable (someone whose role can't change it): the same row as a plain element, with no
        chevron, no press and no focus. */
    readOnly?: boolean;
    /** Gets the row, to anchor a menu to. */
    onClick: (row: HTMLElement) => void;
  }

  let {
    label,
    help = '',
    value = '',
    icon,
    chevron = 'right',
    accent = false,
    quiet = false,
    iconAccent = false,
    helpSummary = false,
    disabled = false,
    readOnly = false,
    onClick,
  }: Props = $props();
  const t = useT();
</script>

{#snippet content()}
  {#if icon}<span class="icon" class:accent={iconAccent} style:mask="var(--icon-{icon}) center/contain no-repeat"></span>{/if}
  <span class="text">
    <span class="label">{t(label)}</span>
    {#if help}<span class="help" class:summary={helpSummary}>{t(help)}</span>{/if}
  </span>
  {#if value}<span class="value" class:accent class:quiet>{t(value)}</span>{/if}
{/snippet}

{#if readOnly}
  <div class="settings-row link-row read-only">{@render content()}</div>
{:else}
  <button
    type="button"
    class="settings-row link-row"
    {disabled}
    aria-haspopup={chevron === 'down' ? 'menu' : undefined}
    onclick={(e) => onClick(e.currentTarget)}>
    {@render content()}
    <span class="chevron {chevron}"></span>
  </button>
{/if}

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .link-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 60px;
    padding: 10px 16px;
    box-sizing: border-box;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active:not(:disabled) {
      background: var(--overlay-1);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }

    &.read-only {
      cursor: default;
    }
  }

  .icon {
    flex: none;
    width: 19px;
    height: 19px;
    background: var(--ink-3);

    &.accent {
      background: var(--accent);
    }
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
  }

  .help {
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;

    &.summary {
      color: var(--ink-2);
      @include truncate;
    }
  }

  .value {
    flex: none;
    max-width: 45%;
    font: var(--weight-medium) text-size(13px) / 1.2 var(--font-sans);
    color: var(--ink-2);
    text-align: end;

    &.accent {
      color: var(--accent-bright);
    }

    &.quiet {
      color: var(--ink-4);
    }
  }

  .chevron {
    @include icon(chevron-right, 14px, var(--ink-4));

    &.right:dir(rtl) {
      transform: scaleX(-1);
    }

    &.down {
      mask: var(--icon-chevron-down) center/contain no-repeat;
    }
  }
</style>
