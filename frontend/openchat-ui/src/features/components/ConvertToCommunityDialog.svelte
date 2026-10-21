<!-- Convert a group into a community: confirm (irreversible warning + what the conversion does) → done.
     Confirm awaits onConfirm ("Converting…", not dismissable): the done step only shows once it resolves (with the new
     community's id, if the host returns one); a rejection stays on confirm with an error. A new `step` from the parent
     takes over again. Finish falls back to onCancel; "Go to the community" passes that id to onGoTo (else onFinish, onCancel).
     Without onConfirm there is no Convert button. Leaving (Cancel, Finish, Go to) animates out and stays out; nothing can
     be started while converting or leaving (lib/behaviours/dialog.svelte.ts). -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { useT, segments, type Segment } from '../../lib/i18n';

  // resource keys, translated at render
  const STEPS = ['freeze', 'createCommunity', 'addChannel', 'addMembers', 'copyHistory', 'deleteGroup'].map((k) => 'ui.convertToCommunityDialog.steps.' + k);

  interface Props {
    groupName: string;
    step?: 'confirm' | 'done';
    /** Convert it. Resolve with the new community's id (passed on to onGoTo); reject to stay on confirm with an error. */
    onConfirm?: () => Promise<{ communityId: string } | unknown> | void;
    onCancel?: () => void;
    onFinish?: () => void;
    onGoTo?: (communityId?: string) => void;
  }

  let { groupName, step = 'confirm', onConfirm, onCancel, onFinish, onGoTo }: Props = $props();
  const t = useT();
  // headlines wrap the group name in its own span and may contain line breaks (\n)
  const headline = $derived(segments(t, 'ui.convertToCommunityDialog.headline', ['name']));
  const doneHeadline = $derived(segments(t, 'ui.convertToCommunityDialog.doneHeadline', ['name']));

  // confirming shows the done step until the parent sends a new step
  let current = $derived(step);

  let communityId = $state<string | undefined>();
  // busy / leaving / the exit: the shared dialog contract
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  const dismiss = (then?: () => void) => flow.dismiss(then);

  async function confirm() {
    if (!onConfirm || current === 'done') return;
    const confirmFn = onConfirm;
    const result = await flow.run(() => confirmFn());
    if (!result.ok) return;
    const id = (result.value as { communityId?: unknown } | undefined)?.communityId;
    communityId = typeof id === 'string' ? id : undefined;
    current = 'done';
  }
</script>

{#snippet sentence(segs: Segment[])}{#each segs as seg}{#if 'slot' in seg}<span class="accent">{groupName}</span>{:else}{#each seg.text.split('\n') as part, i}{#if i}<br />{/if}{part}{/each}{/if}{/each}{/snippet}

<div class="layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="veil" onclick={() => dismiss(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="badge-icon community"></span></span>
      <div class="titles">
        <span class="title">{t('ui.convertToCommunityDialog.title')}</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="icon-button" onclick={() => dismiss(onCancel)} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if current !== 'done'}
        <div class="stack">
          <div class="copy">
            <span class="headline">{@render sentence(headline)}</span>
            <span class="lead">{t('ui.convertToCommunityDialog.lead')}</span>
          </div>

          <div class="cards">
            <div class="notice warn">
              <div class="notice-head"><span class="notice-icon"></span><span class="notice-title">{t('ui.convertToCommunityDialog.irreversibleTitle')}</span></div>
              <span class="notice-text">{t('ui.convertToCommunityDialog.irreversibleText')}</span>
            </div>

            <div class="steps">
              <span class="steps-label">{t('ui.convertToCommunityDialog.stepsLabel')}</span>
              <div class="step-list">
                {#each STEPS as label}
                  <div class="step"><span class="step-check"></span><span class="step-label">{t(label)}</span></div>
                {/each}
              </div>
            </div>
          </div>

          <span class="patience">{t('ui.convertToCommunityDialog.patience')}</span>
        </div>
      {:else}
        <div class="stack">
          <div class="copy">
            <span class="headline">{@render sentence(doneHeadline)}</span>
            <span class="lead">{t('ui.convertToCommunityDialog.doneLead')}</span>
          </div>
          <div class="notice tip">
            <div class="notice-head"><span class="notice-icon"></span><span class="notice-title">{t('ui.convertToCommunityDialog.consolidateTitle')}</span></div>
            <span class="notice-text">{t('ui.convertToCommunityDialog.consolidateText')}</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="foot">
      {#if current !== 'done'}
        <span class="text-button" onclick={() => dismiss(onCancel)} role="button" tabindex="0" aria-disabled={flow.locked}>{t('ui.common.cancel')}</span>
        <span class="grow"></span>
        {#if flow.failed}
          <span class="error" role="alert">{t('ui.convertToCommunityDialog.failed')}</span>
        {/if}
        {#if onConfirm}
          <div class="primary" class:busy={flow.busy} onclick={confirm} role="button" tabindex="0" aria-disabled={flow.locked}>
            <span class="primary-icon community"></span>
            <span>{t(flow.busy ? 'ui.convertToCommunityDialog.converting' : 'ui.convertToCommunityDialog.title')}</span>
          </div>
        {/if}
      {:else}
        <span class="text-button" onclick={() => dismiss(onFinish ?? onCancel)} role="button" tabindex="0">{t('ui.convertToCommunityDialog.finish')}</span>
        <span class="grow"></span>
        <div class="primary" onclick={() => dismiss(onGoTo ? () => onGoTo(communityId) : (onFinish ?? onCancel))} role="button" tabindex="0">
          <span>{t('ui.convertToCommunityDialog.goTo')}</span>
          <span class="primary-icon arrow"></span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .primary.busy {
    opacity: 0.6;
    cursor: default;
  }

  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base) var(--ease-out) both;
  }

  .card {
    position: relative;
    width: 100%;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .layer.closing {
    pointer-events: none;
  }

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1);
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent-dim);
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--accent);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-32) var(--space-18);
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
    min-width: 0;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
    padding-inline: var(--space-14);
  }

  .headline {
    font: var(--weight-bold) var(--text-2xl) / 1.3 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
    text-wrap: pretty;
  }

  .lead {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .accent {
    color: var(--accent-bright);
  }

  .notice {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-16) var(--space-16);
    border-radius: var(--radius-lg);
  }

  .notice.warn {
    background: var(--status-chit-soft);
    box-shadow: inset 0 0 0 1px var(--status-chit);
  }

  .notice-head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .notice-icon {
    flex: none;
    width: 16px;
    height: 16px;
  }

  .warn .notice-icon {
    background: var(--status-chit);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .notice-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .notice-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1);
  }

  .text-button {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .text-button:hover {
    background: var(--accent-soft);
  }

  .grow {
    flex: 1;
  }

  .primary {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .primary:hover {
    background: var(--accent-hover);
  }

  .primary-icon {
    width: 16px;
    height: 16px;
    background: var(--on-accent);
  }

  .card {
    max-width: 560px;
  }

  .community {
    mask: var(--icon-community) center/contain no-repeat;
  }

  .arrow {
    mask: var(--icon-arrow) center/contain no-repeat;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-18) var(--space-16);
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .steps-label {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .step-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-10);
    min-width: 0;
  }

  .step-check {
    flex: none;
    width: 15px;
    height: 15px;
    margin-top: 2px;
    background: var(--accent);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .step-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .patience {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-4);
    text-align: center;
    text-wrap: pretty;
  }

  .notice.tip {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent-dim);
  }

  .tip .notice-icon {
    background: var(--accent-bright);
    mask: var(--icon-info) center/contain no-repeat;
  }
</style>
