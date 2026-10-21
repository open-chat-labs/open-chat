<!-- Confirm leaving a group, channel or community. Cancel plays the close animation, then calls back; Leave calls onConfirm
     and waits: the dialog closes once it resolves and stays open with an error if it rejects (e.g. the sole owner).
     Success contract (same in every confirm/create dialog): once the host's promise resolves the dialog animates out and
     then calls onCancel, so the host unmounts it; it stays hidden (no reappearing, no invisible layer catching clicks). -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';

  interface Props {
    groupName: string;
    noun?: 'group' | 'channel' | 'community';
    /** Overrides the explanation, which otherwise depends on the noun. Resource key (or literal text). */
    body?: string;
    /** Leave. Reject to keep the dialog open with an error. */
    onConfirm?: () => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let { groupName, noun = 'group', body, onConfirm, onCancel }: Props = $props();
  const t = useT();

  const text = $derived(t(body ?? 'ui.leaveGroupDialog.body', { noun }));

  // busy / leaving / the exit: the shared dialog contract (lib/behaviours/dialog.svelte.ts)
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());

  async function confirm() {
    const result = await flow.run(() => onConfirm?.());
    if (result.ok) flow.leave(onCancel);
  }
  const dismiss = () => flow.dismiss(onCancel);
</script>

<div class="layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="veil" onclick={dismiss} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="badge-icon"></span></span>
      <div class="titles">
        <span class="title">{t('ui.leaveGroupDialog.title', { noun })}</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="close" onclick={dismiss} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      <div class="copy">
        <span class="question"><Translate key="ui.leaveGroupDialog.question">{#snippet name()}<span class="name">{groupName}</span>{/snippet}</Translate></span>
        <span class="text">{text}</span>
      </div>
    </div>

    <div class="foot">
      <span class="cancel" onclick={dismiss} role="button" tabindex="0">{t('ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if flow.failed}<span class="error" role="alert">{t('ui.leaveGroupDialog.failed', { noun })}</span>{/if}
      <div class="confirm" class:busy={flow.busy} onclick={confirm} role="button" tabindex="0" aria-disabled={flow.locked}>
        <span class="confirm-icon"></span>
        <span>{t(flow.busy ? 'ui.leaveGroupDialog.leaving' : 'ui.leaveGroupDialog.confirm', { noun })}</span>
      </div>
    </div>
  </div>
</div>

<style>
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
    max-width: 460px;
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

  /* fading out: no longer catches clicks while (or after) it leaves */
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
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--ink-2);
    mask: var(--icon-leave) center/contain no-repeat;
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
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .close:hover {
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

  .copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
    padding-inline: var(--space-14);
  }

  .question {
    font: var(--weight-bold) var(--text-2xl) / 1.3 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
    text-wrap: pretty;
  }

  .name {
    color: var(--accent-bright);
  }

  .text {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2);
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

  .cancel {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--accent-soft);
  }

  .grow {
    flex: 1;
  }

  .confirm {
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

  .confirm.busy {
    opacity: 0.6;
    cursor: default;
  }

  .error {
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--status-danger);
  }

  .confirm:hover {
    background: var(--accent-hover);
  }

  .confirm-icon {
    width: 16px;
    height: 16px;
    background: var(--on-accent);
    mask: var(--icon-leave) center/contain no-repeat;
  }
</style>
