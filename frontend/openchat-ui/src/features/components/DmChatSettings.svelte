<!-- Per-DM settings: disappearing messages (timed) and read receipts. Shared by the DM side panel and the profile dialog's "This chat" tab.
     Changes show at once and roll back with an error if the host's promise rejects; new prop values always win. -->
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

  let on = $derived(disappearOn);
  let after = $derived(disappearAfter);
  let receipts = $derived(readReceipts);
  let failed = $state(false);

  // optimistic changes per field: shown at once. When the latest call for a field rejects, the field falls back to the
  // value the host last accepted (or its prop), never to an earlier optimistic value it didn't confirm. An older call
  // that succeeds after every newer one failed still lands, since that's what the host has now.
  const latest: Record<string, number> = {};
  const settled: Record<string, number> = {};
  const lostLatest: Record<string, number> = {};
  const accepted: Record<string, { value: unknown }> = {};
  async function optimistic<T>(field: string, value: T, set: (v: T) => void, host: () => T, call: () => Promise<unknown> | void) {
    const seq = (latest[field] = (latest[field] ?? 0) + 1);
    failed = false;
    set(value);
    try {
      await call();
      if (seq <= (settled[field] ?? 0)) return;
      settled[field] = seq;
      accepted[field] = { value };
      if (lostLatest[field] === latest[field]) set(value);
    } catch {
      if (latest[field] !== seq) return;
      lostLatest[field] = seq;
      set(field in accepted ? (accepted[field].value as T) : host());
      failed = true;
    }
  }

  // a new value from the host replaces whatever was accepted before it
  $effect.pre(() => {
    void disappearOn;
    void disappearAfter;
    untrack(() => delete accepted.disappear);
  });
  $effect.pre(() => {
    void readReceipts;
    untrack(() => delete accepted.receipts);
  });

  function setDisappear(nextOn: boolean, nextAfter: string) {
    optimistic(
      'disappear',
      { on: nextOn, after: nextAfter },
      (v) => {
        on = v.on;
        after = v.after;
      },
      () => ({ on: disappearOn, after: disappearAfter }),
      () => onDisappearChange?.({ on: nextOn, after: nextAfter, afterMs: durationMs(nextAfter) }),
    );
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
      class:on={receipts}
      onclick={() => {
        const next = !receipts;
        optimistic(
          'receipts',
          next,
          (v) => (receipts = v),
          () => readReceipts,
          () => onReadReceiptsChange?.(next),
        );
      }}
      tabindex="0"
      role="switch"
      aria-checked={receipts}
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
