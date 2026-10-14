<!-- Per-DM settings: disappearing messages (timed) and read receipts. Shared by the DM side panel and the profile dialog's "This chat" tab.
     Edits stick locally until the parent sends new values. -->
<script lang="ts">
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import { useT } from '../../lib/i18n';

  interface Props {
    /** The other person; their first name goes in the read-receipts hint. */
    peerName: string;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    onDisappearChange?: (v: { on: boolean; after: string }) => void;
    onReadReceiptsChange?: (on: boolean) => void;
  }

  let { peerName, disappearOn = false, disappearAfter = '12 hours', readReceipts = false, onDisappearChange, onReadReceiptsChange }: Props = $props();
  const t = useT();

  let on = $derived(disappearOn);
  let after = $derived(disappearAfter);
  let receipts = $derived(readReceipts);
</script>

<div class="settings">
  <div class="timed">
    <TimedToggle
      density="compact"
      icon="clock"
      rowRadius="var(--radius-lg) var(--radius-lg) 0 0"
      label={t('ui.dmChatSettings.disappearingMessages')}
      {on}
      value={after}
      onChange={(next) => {
        on = next;
        onDisappearChange?.({ on: next, after });
      }}
      onDurationChange={(next) => {
        after = next;
        onDisappearChange?.({ on: true, after: next });
      }}
    />
  </div>
  <div class="row">
    <span class="eye"></span>
    <span class="text"><span class="label">{t('ui.dmChatSettings.readReceipts')}</span><span class="hint">{t('ui.dmChatSettings.readReceiptsHint', { name: peerName.split(' ')[0] })}</span></span>
    <span
      class="switch"
      class:on={receipts}
      onclick={() => {
        receipts = !receipts;
        onReadReceiptsChange?.(receipts);
      }}
      tabindex="0"
      role="switch"
      aria-checked={receipts}
      aria-label={t('ui.dmChatSettings.readReceipts')}><span class="knob"></span></span
    >
  </div>
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .timed {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-height: 64px;
    padding: var(--space-12) var(--space-16);
    box-sizing: border-box;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.06));
  }

  .eye {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-eye) center/contain no-repeat;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .label {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .switch {
    flex: none;
    position: relative;
    width: 42px;
    height: 24px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.14));
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch.on {
    background: var(--accent, #ff5672);
  }

  .knob {
    position: absolute;
    top: 3px;
    inset-inline-start: 3px;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--ink-4, #6e6e7c);
    transform: translateX(0);
    transition: transform 0.15s;
  }

  .on .knob {
    background: #fff;
    transform: translateX(calc(var(--oc-dir, 1) * 18px));
  }
</style>
