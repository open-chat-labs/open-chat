<!-- "Claim history": the CHIT claim calendar (ClaimCalendar) in a dialog of its own, opened from the CHIT dialog or the
     profile's CHIT section, and under it the streak insurance (onInsurance). Title bar: a back arrow when it was opened
     from another dialog (onBack, labelled backLabel), the calendar's icon, the title with the streak, and close. Back
     and the insurance hand off with no exit (DialogFlow.handOff), so the next dialog takes this one's place over the
     same backdrop; close plays the exit. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import ClaimCalendar, { type ClaimDay } from './ClaimCalendar.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { useT } from '../../lib/i18n';

  interface Props {
    streak: number;
    /** Claim history for the calendar (any order). */
    claimHistory?: ClaimDay[];
    /** "Today" for the calendar, ms epoch; defaults to now. */
    today?: number;
    /** When the account was created, ms epoch: the calendar doesn't page back before it. */
    joined?: number;
    /** Whether today's claim is open: the calendar's today offers Claim. */
    claimable?: boolean;
    /** Days of streak insurance bought, and of those, used. */
    insured?: number;
    used?: number;
    /** Claim times in UTC instead of local time. */
    utc?: boolean;
    /** Local time offset for the claim times; defaults to this browser's. */
    utcOffsetMinutes?: number;
    /** Resource key (or literal text): the back arrow's label. */
    backLabel?: string;
    onUtcChange?: (utc: boolean) => void;
    /** Claim today's CHIT from the calendar: today says it's claiming until this settles. */
    onClaim?: () => Promise<unknown> | void;
    /** Open streak insurance, in this dialog's place. */
    onInsurance?: () => void;
    /** Opened from another dialog: a back arrow, back to it in this one's place. */
    onBack?: () => void;
    onClose?: () => void;
  }

  let {
    streak,
    claimHistory = [],
    today,
    joined,
    claimable = false,
    insured = 0,
    used = 0,
    utc = false,
    utcOffsetMinutes,
    backLabel = 'ui.claimHistoryDialog.backToChit',
    onUtcChange,
    onClaim,
    onInsurance,
    onBack,
    onClose,
  }: Props = $props();

  const t = useT();
  const insuredLeft = $derived(Math.max(0, insured - used));

  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  const close = () => flow.dismiss(onClose);
  const back = () => onBack && flow.handOff(onBack);
  const insurance = () => onInsurance && flow.handOff(onInsurance);
</script>

<div class="layer oc-dialog-layer" class:closing={flow.closing} data-screen-label="Claim history" role="dialog" aria-modal="true" use:modal={flow.escape(onClose)}>
  <div class="oc-veil" onclick={close} aria-hidden="true"></div>

  <div class="card">
    <div class="head">
      {#if onBack}<span class="icon-button back" onclick={back} role="button" tabindex="0" aria-label={t(backLabel)} title={t(backLabel)}><span class="back-glyph"></span></span>{/if}
      <span class="head-tile"><span class="head-glyph"></span></span>
      <div class="heading">
        <span class="title">{t('ui.claimHistoryDialog.title')}</span>
        <span class="subtitle">{t('ui.claimHistoryDialog.streak', { count: streak })}</span>
      </div>
      <span class="icon-button" onclick={close} role="button" tabindex="0" aria-label={t('ui.common.close')} title={t('ui.common.close')}><span class="close-glyph"></span></span>
    </div>

    <div class="body">
      <ClaimCalendar {claimHistory} {today} {joined} {claimable} {utc} {utcOffsetMinutes} {onClaim} {onUtcChange} />

      <div class="row cover" class:insured={insuredLeft > 0} class:inert={!onInsurance} onclick={insurance} role="button" tabindex="0">
        <span class="tile"><span class="shield"></span></span>
        <div class="row-text">
          <span class="row-title">{t(insuredLeft > 0 ? 'ui.claimHistoryDialog.insurance' : 'ui.claimHistoryDialog.noInsurance')}</span>
          <span class="row-hint"
            >{insured > 0 ? t('ui.claimHistoryDialog.insuranceHint', { insured, used }) : t('ui.claimHistoryDialog.noInsuranceHint')}</span
          >
        </div>
        {#if onInsurance}<span class="chevron"></span>{/if}
      </div>
    </div>
  </div>
</div>

<style>
  .layer {
    z-index: 73;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 600px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-18) 20px;
    border-block-end: 1px solid var(--line-1);
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2);
  }

  .icon-button.back {
    width: 32px;
    height: 32px;
    margin-inline-start: -8px;
  }

  .back-glyph {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .close-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .head-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--status-chit-soft);
  }

  .head-glyph {
    width: 18px;
    height: 18px;
    background: var(--status-chit);
    mask: var(--icon-calendar) center/contain no-repeat;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 20px;
  }

  .row {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .row.inert {
    cursor: default;
  }

  .cover {
    --cover-ink: var(--status-warning);
    background: color-mix(in srgb, var(--status-warning) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-warning) 50%, transparent);
    transition: filter var(--duration-fast) var(--ease-out);
  }

  .cover.insured {
    --cover-ink: var(--status-online);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .cover:not(.inert):hover {
    filter: brightness(1.14);
  }

  .tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cover-ink) 16%, transparent);
  }

  .shield {
    width: 18px;
    height: 18px;
    background: var(--cover-ink);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .row-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .row-title {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .row-hint {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .chevron {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--cover-ink);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }
</style>
