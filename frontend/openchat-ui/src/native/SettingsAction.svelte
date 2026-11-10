<!-- Settings row that does something at once (Clear cached data, Reset to defaults): an icon and a label in the
     accent, or in the danger colour for a destructive one (the host offers Undo in a toast), with an optional line
     under the label that says what it does (in the row's help style). At least 52px. -->
<script lang="ts">
  import { useT } from '../lib/i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** An icons.js name. */
    icon: string;
    /** Resource key (or literal text): a line under the label, saying what it does. */
    help?: string;
    danger?: boolean;
    onClick: () => void;
  }

  let { label, icon, help = '', danger = false, onClick }: Props = $props();
  const t = useT();
</script>

<button type="button" class="settings-row action-row" class:danger class:with-help={!!help} onclick={onClick}>
  <span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
  {#if help}
    <span class="text">
      <span class="label">{t(label)}</span>
      <span class="help">{t(help)}</span>
    </span>
  {:else}
    <span class="label">{t(label)}</span>
  {/if}
</button>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .action-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 0 16px;
    box-sizing: border-box;
    border: 0;
    background: none;
    color: var(--accent-bright);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &.danger {
      color: var(--status-danger);
    }

    // with a line under the label: the icon stays by its first line (the label's line is the icon's 19px)
    &.with-help {
      align-items: flex-start;
      padding: 12px 16px;
    }

    &:active {
      background: var(--overlay-1);
    }
  }

  .icon {
    flex: none;
    width: 19px;
    height: 19px;
    background: currentColor;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font: var(--weight-semibold) text-size(15px) / 1 var(--font-sans);
  }

  .with-help .label {
    line-height: 19px;
  }

  .help {
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }
</style>
