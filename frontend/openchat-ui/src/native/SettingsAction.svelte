<!-- Settings row that does something at once (Clear cached data, Reset to defaults): an icon and a label in the
     accent, or in the danger colour for a destructive one (the host offers Undo in a toast). At least 52px. -->
<script lang="ts">
  import { useT } from '../lib/i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** An icons.js name. */
    icon: string;
    danger?: boolean;
    onClick: () => void;
  }

  let { label, icon, danger = false, onClick }: Props = $props();
  const t = useT();
</script>

<button type="button" class="settings-row action-row" class:danger onclick={onClick}>
  <span class="icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
  <span class="label">{t(label)}</span>
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

  .label {
    font: var(--weight-semibold) text-size(15px) / 1 var(--font-sans);
  }
</style>
