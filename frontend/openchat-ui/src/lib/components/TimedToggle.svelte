<!-- A switch with a timed value: the value is the row's subtitle, tapping the row expands the picker.
     Used for disappearing messages (DMs, groups, channels) and access-gate re-checks.
     density: compact (64px row, clock icon) | regular (taller text, no icon) | flush (no padding or hover, for nesting). -->
<script lang="ts">
  import { useT } from '../i18n';
  const ICONS = { clock: 'var(--icon-clock) center/contain no-repeat', refresh: 'var(--icon-refresh) center/contain no-repeat' };
  const DURATIONS = ['1 hour', '8 hours', '12 hours', '1 day', '1 week', '30 days'];
  // durations stay English values (what onDurationChange reports); these keys are only for display
  const DURATION_KEYS: Record<string, string> = {
    '1 hour': 'ui.timedToggle.durations.oneHour',
    '8 hours': 'ui.timedToggle.durations.eightHours',
    '12 hours': 'ui.timedToggle.durations.twelveHours',
    '1 day': 'ui.timedToggle.durations.oneDay',
    '1 week': 'ui.timedToggle.durations.oneWeek',
    '30 days': 'ui.timedToggle.durations.thirtyDays',
    Always: 'ui.timedToggle.durations.always',
  };

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    on?: boolean;
    value: string;
    options?: string[];
    /** Subtitle while on: resource key with a {value} placeholder ("After {value}"); text without one is followed by
        the value. */
    prefix?: string;
    /** Subtitle while off: resource key (or literal text). */
    offHint?: string;
    /** Defaults to clock, except for density "regular" (none). */
    icon?: keyof typeof ICONS | null;
    density?: 'compact' | 'regular' | 'flush';
    defaultOpen?: boolean;
    /** Keep the picker open after choosing. */
    stayOpen?: boolean;
    /** Open the picker when switched on. */
    openOnEnable?: boolean;
    readOnly?: boolean;
    rowRadius?: string;
    onChange?: (on: boolean) => void;
    onDurationChange?: (value: string) => void;
  }

  let {
    label,
    on = false,
    value,
    options,
    prefix = 'ui.timedToggle.after',
    offHint = 'ui.timedToggle.off',
    icon,
    density = 'compact',
    defaultOpen = false,
    stayOpen = false,
    openOnEnable = true,
    readOnly = false,
    rowRadius = '0px',
    onChange,
    onDurationChange,
  }: Props = $props();
  const t = useT();

  // local edits stick until the parent sends new values
  let enabled = $derived(on);
  let current = $derived(value);
  let openState = $state<boolean | undefined>(undefined);

  const open = $derived(!readOnly && enabled && (openState ?? defaultOpen));
  const shownIcon = $derived(icon === undefined ? (density === 'compact' ? 'clock' : null) : icon);
  const list = $derived(options?.length ? options : DURATIONS);

  const duration = (v: string) => t(DURATION_KEYS[v] ?? v);
  const MARK = '\u0001';
  const withPrefix = (v: string) => {
    const text = t(prefix, { value: MARK });
    return text.includes(MARK) ? text.replace(MARK, duration(v)) : `${text} ${duration(v)}`;
  };

  function setOn(next: boolean) {
    enabled = next;
    openState = next ? openOnEnable : false;
    onChange?.(next);
  }

  function pick(next: string) {
    current = next;
    openState = stayOpen;
    onDurationChange?.(next);
  }

  // tapping the row while off turns it on and opens the picker; the switch alone toggles
  function toggleExpand() {
    if (readOnly) return;
    if (!enabled) setOn(true);
    else openState = !open;
  }
</script>

<div class="timed {density}" class:has-icon={!!shownIcon}>
  <div
    class="row"
    class:readonly={readOnly}
    style:border-radius={rowRadius}
    onclick={toggleExpand}
    role={readOnly ? 'group' : 'button'}
    tabindex={readOnly ? -1 : 0}
    aria-expanded={open}
  >
    {#if shownIcon}
      <span class="icon" style:mask={ICONS[shownIcon] ?? ICONS.clock}></span>
    {/if}
    <span class="text">
      <span class="label">{t(label)}</span>
      <span class="sub" class:on={enabled}
        >{enabled ? withPrefix(current) : t(offHint)}{#if enabled && !readOnly}<span class="caret" class:open></span>{/if}</span
      >
    </span>
    {#if readOnly}
      <span class="status">{enabled ? t('ui.timedToggle.onValue', { value: duration(current) }) : t('ui.timedToggle.off')}</span>
    {:else}
      <span
        class="switch"
        class:on={enabled}
        onclick={(e) => {
          e.stopPropagation();
          setOn(!enabled);
        }}
        tabindex="0"
        role="switch"
        aria-checked={enabled}
        aria-label={t(label)}><span class="knob"></span></span
      >
    {/if}
  </div>
  {#if open}
    <div class="choices" role="radiogroup" aria-label={t(label)}>
      {#each list as choice}
        <span class="choice" class:selected={choice === current} onclick={() => pick(choice)} tabindex="0" role="radio" aria-checked={choice === current}>{duration(choice)}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timed {
    --pad-x: var(--space-16);
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .flush {
    --pad-x: 0px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-height: 64px;
    padding: var(--space-12) var(--space-16);
    box-sizing: border-box;
    cursor: pointer;
  }

  .regular .row {
    align-items: flex-start;
    gap: var(--space-16);
    min-height: 0px;
    padding: var(--space-16);
  }

  .flush .row {
    align-items: flex-start;
    gap: var(--space-16);
    min-height: 0px;
    padding: 0px;
  }

  .row:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.03));
  }

  .row.readonly {
    cursor: default;
  }

  .row.readonly:hover,
  .flush .row:hover {
    background: transparent;
  }

  .icon {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--ink-3, #9a9aa8);
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .regular .text,
  .flush .text {
    gap: 3px;
  }

  .label {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .regular .label,
  .flush .label {
    font-size: var(--text-base);
  }

  .sub {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .sub.on {
    color: var(--accent-bright, #ff8298);
  }

  .caret {
    flex: none;
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-chevron-down) center/contain no-repeat;
    transition: transform 0.15s;
  }

  .caret.open {
    transform: rotate(180deg);
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

  .status {
    flex: none;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-6);
    margin-top: 2px;
    padding: var(--space-10) var(--pad-x) var(--space-18) var(--pad-x);
    border-top: 1px dashed var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .has-icon .choices {
    padding-left: calc(var(--pad-x) + 31px);
  }

  .choice {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 var(--space-6);
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }

  .choice.selected {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
    color: var(--accent-bright, #ff8298);
  }

  .choice:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }
</style>
