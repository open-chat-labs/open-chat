<!-- Per-DM settings: disappearing messages (timed) and read receipts. Shared by the DM side panel and the profile dialog's "This chat" tab.
     Changes show at once; when the latest one is rejected the field falls back to the host's last accepted value with an
     error. New prop values are followed once nothing is in flight. -->
<script lang="ts" module>
  // the duration ids TimedToggle uses ('12 hours', '1 week' …) in milliseconds; months count as 30 days
  const UNIT_MS: Record<string, number> = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
  export const durationMs = (id: string) => {
    const m = id.match(/^(\d+) (minute|hour|day|week|month|year)s?$/);
    return m ? Number(m[1]) * UNIT_MS[m[2]] : 0;
  };

  export interface DisappearSetting {
    on: boolean;
    /** Duration id, e.g. "12 hours". */
    after: string;
    /** The same duration in milliseconds. */
    afterMs: number;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { useT } from '../../lib/i18n';

  interface Props {
    /** The other person; their first name goes in the read-receipts hint. */
    peerName: string;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    onDisappearChange?: (v: DisappearSetting) => Promise<unknown> | void;
    onReadReceiptsChange?: (on: boolean) => Promise<unknown> | void;
  }

  let { peerName, disappearOn = false, disappearAfter = '12 hours', readReceipts = false, onDisappearChange, onReadReceiptsChange }: Props = $props();
  const t = useT();

  // optimistic per field (lib/behaviours/optimistic.svelte.ts): shown at once, the latest call wins, a rejected latest
  // call falls back to the value the host last accepted; new host values are followed once nothing is in flight
  const disappear = new Optimistic(() => ({ on: disappearOn, after: disappearAfter }));
  const receipts = new Optimistic(() => readReceipts);
  $effect.pre(() => {
    void disappearOn;
    void disappearAfter;
    untrack(() => disappear.sync());
  });
  $effect.pre(() => {
    void readReceipts;
    untrack(() => receipts.sync());
  });
  const on = $derived(disappear.current.on);
  const after = $derived(disappear.current.after);
  // the error belongs to whichever field changed last
  let lastField = $state<'disappear' | 'receipts'>('disappear');
  const failed = $derived(lastField === 'disappear' ? disappear.failed : receipts.failed);

  function setDisappear(nextOn: boolean, nextAfter: string) {
    lastField = 'disappear';
    disappear.set({ on: nextOn, after: nextAfter }, () => onDisappearChange?.({ on: nextOn, after: nextAfter, afterMs: durationMs(nextAfter) }));
  }

  function toggleReceipts() {
    lastField = 'receipts';
    const next = !receipts.current;
    receipts.set(next, () => onReadReceiptsChange?.(next));
  }
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
      onChange={(next) => setDisappear(next, after)}
      onDurationChange={(next) => setDisappear(true, next)}
    />
  </div>
  <div class="row">
    <span class="eye"></span>
    <span class="text"><span class="label">{t('ui.dmChatSettings.readReceipts')}</span><span class="hint">{t('ui.dmChatSettings.readReceiptsHint', { name: peerName.split(' ')[0] })}</span></span>
    <span
      class="switch"
      class:on={receipts.current}
      onclick={toggleReceipts}
      tabindex="0"
      role="switch"
      aria-checked={receipts.current}
      aria-label={t('ui.dmChatSettings.readReceipts')}><span class="knob"></span></span
    >
  </div>
  {#if failed}<span class="error" role="alert">{t('ui.dmChatSettings.saveFailed')}</span>{/if}
</div>

<style>
  .error {
    padding: 0 var(--space-16) var(--space-12);
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

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
