<!-- Settings row: a switch with its label and help (native design notes §1 Spacing: the help says what the setting
     is and never changes with it). At least 72px; the whole row flips it. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import Toggle from '../lib/components/Toggle.svelte';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text): what the setting is. */
    help?: string;
    on: boolean;
    disabled?: boolean;
    onChange: (on: boolean) => void;
  }

  let { label, help = '', on, disabled = false, onChange }: Props = $props();
  const t = useT();

  // the switch flips itself; a tap elsewhere on the row flips it too
  function rowTap(e: MouseEvent) {
    if (disabled || (e.target instanceof Element && e.target.closest('[role="switch"]'))) return;
    onChange(!on);
  }
</script>

<!-- the switch is the control (keyboard included); the row's tap is a bigger target for touch -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="settings-row switch-row" class:disabled onclick={rowTap}>
  <span class="text">
    <span class="label">{t(label)}</span>
    {#if help}<span class="help">{t(help)}</span>{/if}
  </span>
  <Toggle {on} {disabled} ariaLabel={label} {onChange} />
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .switch-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 72px;
    padding: 12px 16px;
    box-sizing: border-box;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &.disabled {
      cursor: default;
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
    font: var(--weight-medium) text-size(15px) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .help {
    font: var(--weight-regular) text-size(13px) / 1.45 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }
</style>
