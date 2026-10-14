<!-- Confirm leaving a group, channel or community. Cancel plays the close animation, then calls back; Leave calls onConfirm
     and waits: the dialog closes once it resolves and stays open with an error if it rejects (e.g. the sole owner). -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';

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

  let closing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  // play the exit animation, then hand control back
  function close(then?: () => void) {
    if (closing) return;
    closing = true;
    timer = setTimeout(() => {
      closing = false;
      then?.();
    }, 170);
  }

  // confirming waits for the host: the dialog closes once it resolves, and stays with an error if it rejects
  let busy = $state(false);
  let failed = $state(false);
  async function confirm() {
    if (busy || closing) return;
    busy = true;
    failed = false;
    try {
      await onConfirm?.();
    } catch {
      failed = true;
      return;
    } finally {
      busy = false;
    }
    close();
  }
  // no dismissing while the host is working on it
  const dismiss = () => !busy && close(onCancel);
</script>

<div class="layer" class:closing role="dialog" aria-modal="true" use:modal={dismiss}>
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
      {#if failed}<span class="error" role="alert">{t('ui.leaveGroupDialog.failed', { noun })}</span>{/if}
      <div class="confirm" class:busy onclick={confirm} role="button" tabindex="0" aria-disabled={busy}>
        <span class="confirm-icon"></span>
        <span>{t(busy ? 'ui.leaveGroupDialog.leaving' : 'ui.leaveGroupDialog.confirm', { noun })}</span>
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
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
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
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
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
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--ink-2, #b9b9c6);
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
    color: var(--ink, #ececf1);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
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
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .name {
    color: var(--accent-bright, #ff8298);
  }

  .text {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cancel {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
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
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
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
    color: var(--status-danger, #f5493d);
  }

  .confirm:hover {
    background: var(--accent-hover, #ff6d85);
  }

  .confirm-icon {
    width: 16px;
    height: 16px;
    background: var(--on-accent, #2e0512);
    mask: var(--icon-leave) center/contain no-repeat;
  }
</style>
