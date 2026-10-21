<!-- Access gates as cards (alternative layout to AccessGates): each gate is a card with its icon, description and
     value chips; configurable gates open inline editors (asset picker + numeric fields) until complete.
     "Add gate" opens a catalogue. All / Any decides how gates combine; an optional periodic re-check sits below.
     Non-diamond users see an upgrade card instead. onChange({ count, mode, gates, complete, intervalOn, everyDays }) on every change
     (gates, All / Any, re-check). Tokens and nervous systems come from the host; a gate stores the canister id. `value`
     restores the last state handed out, so the editor survives a remount. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { AccessGatesCardsState, AccessGateRule } from '../../lib/types';
  import type { GateAsset } from './AccessGates.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import { cleanAmount } from '../../lib/amount';
  import { useT } from '../../lib/i18n';

  type Field = { key: 'a' | 'b'; placeholder: string; unit: string; required?: boolean };
  type GateType = {
    label: string;
    icon: string;
    desc: string;
    /** Needs an asset from this list. */
    assets?: 'token' | 'sns';
    repeatable?: boolean;
    uniqueAsset?: boolean;
    fields?: Field[];
    chips?: (g: AccessGateRule) => ({ label: string; dot?: boolean } | false | '')[];
    soon?: boolean;
  };

  const DOTS: Record<string, string> = {
    CHAT: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    ICP: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    BTC: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    BOB: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    USDC: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    USDT: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    KINIC: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    Motoko: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    ICPanda: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    TACO: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    'Dragging Karma Points': 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    'Internet Computer': 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };
  const DOT_FALLBACK = 'linear-gradient(140deg,#8E9BB3,#5A6478)';


  // labels, descriptions, placeholders and units are resource keys; chips are built (translated) at render time
  const TYPES: Record<string, GateType> = {
    lifetime: { label: 'ui.accessGatesCards.types.lifetime', icon: 'diamond', desc: 'ui.accessGatesCards.types.lifetimeDesc' },
    diamond: { label: 'ui.accessGatesCards.types.diamond', icon: 'diamond-outline', desc: 'ui.accessGatesCards.types.diamondDesc' },
    neuron: {
      label: 'ui.accessGatesCards.types.neuron',
      icon: 'neuron',
      desc: 'ui.accessGatesCards.types.neuronDesc',
      assets: 'sns',
      repeatable: true,
      fields: [
        { key: 'a', placeholder: 'ui.accessGatesCards.fields.minDissolveDelay', unit: 'ui.accessGatesCards.units.days' },
        { key: 'b', placeholder: 'ui.accessGatesCards.fields.minStake', unit: 'ui.accessGatesCards.units.tokens' },
      ],
      chips: (g) => [g.asset && { label: assetText(g), dot: true }, g.a && { label: t('ui.accessGatesCards.chips.delay', { days: g.a }) }, g.b && { label: t('ui.accessGatesCards.chips.staked', { amount: g.b }) }],
    },
    payment: {
      label: 'ui.accessGatesCards.types.payment',
      icon: 'payment',
      desc: 'ui.accessGatesCards.types.paymentDesc',
      assets: 'token',
      repeatable: true,
      fields: [{ key: 'a', placeholder: 'ui.accessGatesCards.fields.amount', unit: 'ui.accessGatesCards.units.tokens', required: true }],
      chips: (g) => [g.asset && { label: assetText(g), dot: true }, g.a && { label: t('ui.accessGatesCards.chips.tokens', { amount: g.a }) }],
    },
    balance: {
      label: 'ui.accessGatesCards.types.balance',
      icon: 'balance',
      desc: 'ui.accessGatesCards.types.balanceDesc',
      assets: 'token',
      repeatable: true,
      uniqueAsset: true,
      fields: [{ key: 'a', placeholder: 'ui.accessGatesCards.fields.minBalance', unit: 'ui.accessGatesCards.units.tokens', required: true }],
      chips: (g) => [g.asset && { label: assetText(g), dot: true }, g.a && { label: t('ui.accessGatesCards.chips.min', { amount: g.a }) }],
    },
    credential: { label: 'ui.accessGatesCards.types.credential', icon: 'credential', desc: 'ui.accessGatesCards.types.credentialDesc' },
    unique: { label: 'ui.accessGatesCards.types.unique', icon: 'person', desc: 'ui.accessGatesCards.types.uniqueDesc' },
    locked: { label: 'ui.accessGatesCards.types.locked', icon: 'lock', desc: 'ui.accessGatesCards.types.lockedDesc' },
    chit: {
      label: 'ui.accessGatesCards.types.chit',
      icon: 'chit',
      desc: 'ui.accessGatesCards.types.chitDesc',
      fields: [{ key: 'a', placeholder: 'ui.accessGatesCards.fields.minChit', unit: 'CHIT', required: true }],
      chips: (g) => [g.a && { label: t('ui.accessGatesCards.chips.chit', { amount: g.a }) }],
    },
    nft: { label: 'ui.accessGatesCards.types.nft', icon: 'nft', desc: 'ui.accessGatesCards.types.nftDesc', soon: true },
  };

  const MODES = ['All', 'Any'] as const;
  const MODE_LABELS = ['ui.accessGatesCards.modes.all', 'ui.accessGatesCards.modes.any'];
  // labels are resource keys; the host gets the interval in days
  const INTERVALS: [string, number][] = [
    ['ui.accessGatesCards.intervals.day1', 1],
    ['ui.accessGatesCards.intervals.week1', 7],
    ['ui.accessGatesCards.intervals.weeks2', 14],
    ['ui.accessGatesCards.intervals.month1', 30],
    ['ui.accessGatesCards.intervals.months3', 90],
    ['ui.accessGatesCards.intervals.months6', 180],
  ];
  const mask = (icon: string) => `var(--icon-${icon}) center/contain no-repeat`;

  interface Props {
    /** false (the default) shows the upgrade card instead of the editor. */
    isDiamond?: boolean;
    /** Tokens payment / balance gates can name (ledger canister ids). Those gates are hidden while this is empty. */
    tokens?: GateAsset[];
    /** Nervous systems neuron gates can name (governance canister ids). */
    nervousSystems?: GateAsset[];
    /** State last handed out by onChange; read once, on mount. */
    value?: Partial<AccessGatesCardsState> | null;
    onUpgrade?: () => void;
    onChange?: (state: AccessGatesCardsState) => void;
  }

  let { isDiamond = false, tokens = [], nervousSystems = [], value = null, onUpgrade, onChange }: Props = $props();
  const t = useT();

  const dirFor = (kind: 'token' | 'sns' | undefined) => (kind === 'sns' ? nervousSystems : tokens);
  // tokens read as their symbol, nervous systems as their name; an unknown id is shown as it is
  function labelOf(kind: 'token' | 'sns' | undefined, id: string) {
    const a = dirFor(kind).find((x) => x.id === id);
    return a ? (kind === 'sns' ? a.name : a.symbol) : id;
  }
  function assetText(g: AccessGateRule) {
    return labelOf(TYPES[g.type]?.assets, g.asset);
  }
  const offered = (type: GateType) => !type.assets || dirFor(type.assets).length > 0;

  const initial = untrack(() => value) ?? {};
  let gates = $state<AccessGateRule[]>(Array.isArray(initial.gates) ? initial.gates : []);
  let modeIndex = $state(initial.mode === 'Any' ? 1 : 0);
  let editing = $state<string | null>(null);
  // long directories show their featured assets (plus the one picked); the rest are found by searching
  const PILL_LIMIT = 8;
  let assetQuery = $state('');
  $effect(() => {
    void editing;
    assetQuery = '';
  });
  function pillsFor(kind: 'token' | 'sns', selected: string) {
    const all = dirFor(kind);
    if (all.length <= PILL_LIMIT) return { pills: all, more: false };
    const base = all.filter((a) => a.featured || a.id === selected);
    const q = assetQuery.trim().toLowerCase();
    const found = q ? all.filter((a) => !base.includes(a) && `${a.symbol} ${a.name}`.toLowerCase().includes(q)).slice(0, PILL_LIMIT) : [];
    return { pills: [...base, ...found], more: true };
  }
  let pickerOpen = $state(false);
  let intervalOn = $state(!!initial.intervalOn);
  let everyDays = $state(initial.everyDays ?? 30);
  const everyKey = $derived((INTERVALS.find(([, d]) => d === everyDays) ?? INTERVALS[3])[0]);

  function emit() {
    onChange?.({ count: gates.length, mode: MODES[modeIndex], gates, complete: gates.every(complete), intervalOn, everyDays });
  }

  function add(key: string) {
    const t = TYPES[key];
    if (t.soon) return;
    const gate = { id: `g${Date.now()}`, type: key, asset: '', a: '', b: '' };
    gates = [...gates, gate];
    pickerOpen = false;
    editing = t.fields || t.assets ? gate.id : null;
    emit();
  }

  function patch(id: string, change: Partial<AccessGateRule>) {
    gates = gates.map((g) => (g.id === id ? { ...g, ...change } : g));
    emit();
  }

  function remove(id: string) {
    gates = gates.filter((g) => g.id !== id);
    if (editing === id) editing = null;
    emit();
  }

  function complete(g: AccessGateRule) {
    const t = TYPES[g.type];
    if (t.assets && !g.asset) return false;
    return !(t.fields ?? []).some((f) => f.required && !g[f.key].trim());
  }
</script>

<div class="gates">
  {#if !isDiamond}
    <div class="upsell">
      <span class="upsell-title">{t('ui.accessGatesCards.upgradeTitle')}</span>
      <span class="upsell-text">{t('ui.accessGatesCards.upgradeText')}</span>
      <div class="upsell-button" onclick={onUpgrade} role="button" tabindex="0">{t('ui.accessGatesCards.getDiamond')}</div>
    </div>
  {:else}
    <div class="head">
      <div class="head-text">
        <span class="head-title">{t('ui.accessGatesCards.heading', { count: gates.length })}</span>
        <span class="head-hint">{t('ui.accessGatesCards.invitedHint')}</span>
      </div>
      <div class="modes">
        <SegmentedTabs
          labels={MODE_LABELS.map((k) => t(k))}
          selectedIndex={modeIndex}
          dotIndexes={[]}
          onSelect={(i) => {
            modeIndex = i;
            emit();
          }}
        />
      </div>
    </div>

    <div class="cards">
      {#each gates as g}
        {@const type = TYPES[g.type]}
        {@const ok = complete(g)}
        {@const chips = (type.chips?.(g) ?? []).filter((c) => !!c)}
        <div class="card" class:incomplete={!ok}>
          <div class="card-head">
            <span class="tile"><span class="tile-icon" style:mask={mask(type.icon)}></span></span>
            <div class="card-text">
              <span class="card-title">{t(type.label)}</span>
              <span class="card-desc">{t(type.desc)}</span>
            </div>
            <div class="card-tools">
              {#if type.fields || type.assets}
                <span class="tool" onclick={() => (editing = g.id)} role="button" tabindex="0" aria-label={t('ui.accessGatesCards.editValues')} title={t('ui.accessGatesCards.editValues')}><span class="tool-icon" style:mask={mask('edit')}></span></span>
              {/if}
              <span class="tool" onclick={() => remove(g.id)} role="button" tabindex="0" aria-label={t('ui.accessGatesCards.removeGate')} title={t('ui.accessGatesCards.removeGate')}><span class="tool-icon" style:mask={mask('close')}></span></span>
            </div>
          </div>

          {#if editing !== g.id && chips.length > 0}
            <div class="chips">
              {#each chips as chip}
                {#if chip}
                  <span class="chip">
                    {#if chip.dot}<span class="chip-dot" style:background={DOTS[chip.label] ?? DOT_FALLBACK}></span>{/if}
                    <span class="chip-label">{chip.label}</span>
                  </span>
                {/if}
              {/each}
            </div>
          {/if}

          {#if editing === g.id}
            <div class="editor">
              {#if type.assets}
                {@const picker = pillsFor(type.assets, g.asset)}
                <div class="assets">
                  {#each picker.pills as a (a.id)}
                    {@const name = labelOf(type.assets, a.id)}
                    {@const taken = !!type.uniqueAsset && gates.some((x) => x.type === g.type && x.asset === a.id && x.id !== g.id)}
                    <span
                      class="asset"
                      class:selected={g.asset === a.id}
                      class:unavailable={taken}
                      onclick={() => {
                        if (taken) return;
                        patch(g.id, { asset: a.id });
                        assetQuery = '';
                      }}
                      role="button"
                      tabindex="0"
                    >
                      <span class="asset-dot" style:background={DOTS[name] ?? DOT_FALLBACK}></span>
                      <span>{taken ? t('ui.accessGatesCards.assetUsed', { name }) : name}</span>
                    </span>
                  {/each}
                  {#if picker.more}
                    <input class="asset-search" bind:value={assetQuery} placeholder={t('ui.accessGatesCards.searchAssets')} aria-label={t('ui.accessGatesCards.searchAssets')} />
                  {/if}
                </div>
              {/if}
              {#each type.fields ?? [] as f}
                <div class="field" class:missing={f.required && !g[f.key].trim()}>
                  <input value={g[f.key]} oninput={(e) => {
                      // "," is a decimal mark too ("1,5" is 1.5); stored with "." so the host reads it as a number
                      const v = cleanAmount(e.currentTarget.value).replace(',', '.');
                      e.currentTarget.value = v;
                      patch(g.id, { [f.key]: v });
                    }} placeholder={t(f.placeholder)} inputmode="numeric" />
                  <span class="unit">{t(f.unit)}</span>
                </div>
              {/each}
              <div class="done-row">
                <div class="done" class:ready={ok} onclick={() => ok && (editing = null)} role="button" tabindex="0">{t('ui.common.done')}</div>
              </div>
            </div>
          {/if}
        </div>
      {/each}

      {#if gates.length === 0}
        <div class="empty">
          <span class="empty-title">{t('ui.accessGatesCards.emptyTitle')}</span>
          <span class="empty-hint">{t('ui.accessGatesCards.emptyHint')}</span>
        </div>
      {/if}

      <div class="add" onclick={() => (pickerOpen = true)} role="button" tabindex="0">
        <span class="add-icon"></span>
        <span>{t('ui.accessGatesCards.addGate')}</span>
      </div>
    </div>

    <div class="rule"></div>

    <div class="recheck">
      <div class="recheck-cell">
        <TimedToggle
          density="flush"
          label={t('ui.accessGatesCards.recheck')}
          prefix={t('ui.accessGatesCards.every')}
          offHint={t('ui.accessGatesCards.recheckOff')}
          on={intervalOn}
          value={t(everyKey)}
          options={INTERVALS.map(([k]) => t(k))}
          onChange={(on) => {
            intervalOn = on;
            emit();
          }}
          onDurationChange={(label) => {
            everyDays = INTERVALS.find(([k]) => t(k) === label)?.[1] ?? everyDays;
            emit();
          }}
        />
      </div>
    </div>
  {/if}

  {#if pickerOpen}
    <div class="picker-layer" role="dialog" aria-modal="true">
      <div class="scrim" onclick={() => (pickerOpen = false)} aria-hidden="true"></div>
      <div class="picker">
        <div class="picker-head">
          <span class="picker-title">{t('ui.accessGatesCards.pickerTitle')}</span>
          <span class="picker-close" onclick={() => (pickerOpen = false)} role="button" tabindex="0"><span class="tool-icon" style:mask={mask('close')}></span></span>
        </div>
        <div class="catalogue">
          {#each Object.entries(TYPES).filter(([, type]) => offered(type)) as [key, type]}
            {@const used = !type.repeatable && gates.some((g) => g.type === key)}
            <div class="option" class:unavailable={type.soon || used} onclick={() => !used && add(key)} role="button" tabindex="0">
              <span class="option-tile"><span class="option-icon" style:mask={mask(type.icon)}></span></span>
              <div class="option-text">
                <div class="option-line">
                  <span class="option-label">{t(type.label)}</span>
                  {#if type.soon}<span class="soon">{t('ui.accessGatesCards.soon')}</span>{/if}
                </div>
                <span class="option-desc">{used ? t('ui.accessGatesCards.alreadyAdded') : t(type.desc)}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gates {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
  }

  .upsell {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
    padding: var(--space-22);
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: linear-gradient(150deg, rgba(255, 86, 114, 0.14), rgba(61, 155, 255, 0.12));
    box-shadow: inset 0 0 0 1px rgba(255, 130, 152, 0.4);
  }

  .upsell-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .upsell-text {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .upsell-button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--control-lg);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-16);
    min-width: 0;
    padding-inline: var(--space-2);
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .head-title {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3);
  }

  .head-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .modes {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 190px;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .card {
    --card-line: var(--line-2);
    --card-tile: color-mix(in srgb, var(--status-verified) 16%, transparent);
    --card-ink: var(--status-verified);
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--card-line);
  }

  .card.incomplete {
    --card-line: color-mix(in srgb, var(--status-warning) 45%, transparent);
    --card-tile: var(--overlay-2);
    --card-ink: var(--status-warning);
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    min-width: 0;
  }

  .tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--card-tile);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .tile-icon {
    width: 20px;
    height: 20px;
    background: var(--card-ink);
  }

  .card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-title {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .card-desc {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .card-tools {
    flex: none;
    display: flex;
    gap: 2px;
  }

  .tool,
  .picker-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .picker-close {
    flex: none;
    width: 30px;
    height: 30px;
  }

  .tool:hover,
  .picker-close:hover {
    background: var(--overlay-2);
  }

  .tool-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .chips,
  .editor {
    min-width: 0;
    padding-inline-start: 50px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--overlay-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .chip-dot {
    flex: none;
    width: 13px;
    height: 13px;
    border-radius: var(--radius-pill);
  }

  .chip-label {
    font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-mono);
    color: var(--ink-2);
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }

  .assets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    min-width: 0;
  }

  .asset-search {
    flex: 1 1 140px;
    min-width: 120px;
    height: 30px;
    padding: 0 var(--space-10);
    box-sizing: border-box;
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    outline: none;
  }

  .asset-search:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .asset {
    display: inline-flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .asset.selected {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--accent-bright);
  }

  .asset.unavailable {
    color: var(--ink-4);
    cursor: not-allowed;
  }

  .asset-dot {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    max-width: 320px;
    padding: 0 var(--space-12);
    height: 42px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .field.missing {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-warning) 50%, transparent);
  }

  .field input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .unit {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .done-row {
    display: flex;
    gap: var(--space-8);
  }

  .done {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-14);
    height: 34px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
    cursor: not-allowed;
    user-select: none;
  }

  .done.ready {
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-26) var(--space-18);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--line-2);
  }

  .empty-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink-2);
  }

  .empty-hint {
    max-width: 320px;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 44px;
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--line-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .add:hover {
    background: var(--accent-soft);
  }

  .add-icon {
    width: 15px;
    height: 15px;
    background: var(--accent);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .rule {
    height: 1px;
    background: var(--line-1);
  }

  .recheck {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    padding-inline: var(--space-2);
  }

  .recheck-cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .picker-layer {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
  }

  .picker {
    position: relative;
    width: 100%;
    max-width: 480px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 30px 70px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .picker-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1);
  }

  .picker-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .catalogue {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-12);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    --option-ink: var(--ink);
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-12);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .option.unavailable {
    --option-ink: var(--ink-4);
    cursor: not-allowed;
  }

  .option:hover {
    background: var(--overlay-1);
  }

  .option-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
  }

  .option-icon {
    width: 17px;
    height: 17px;
    background: var(--option-ink);
  }

  .option-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .option-label {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--option-ink);
  }

  .soon {
    flex: none;
    padding: 1px var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-2xs) / 1.4 var(--font-mono);
    color: var(--ink-4);
  }

  .option-desc {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }
</style>
