<!-- Confirm deleting a group, channel or community: Delete arms only once the name is typed (case-insensitive).
     Cancel plays the close animation, then calls back; Delete calls onConfirm and waits: the dialog closes once it resolves
     and stays open (with the typed name) and an error if it rejects.
     Success contract (same in every confirm/create dialog): once the host's promise resolves the dialog animates out and
     then calls onCancel, so the host unmounts it; it stays hidden (no reappearing, no invisible layer catching clicks). -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';

  interface Props {
    groupName: string;
    noun?: 'group' | 'channel' | 'community';
    /** Delete. Reject to keep the dialog open with an error. */
    onConfirm?: () => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let { groupName, noun = 'group', onConfirm, onCancel }: Props = $props();
  const t = useT();

  let typed = $state('');
  const armed = $derived(typed.trim().toLowerCase() === groupName.trim().toLowerCase());

  // busy / leaving / the exit: the shared dialog contract (lib/behaviours/dialog.svelte.ts)
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());

  async function confirm() {
    if (!armed) return;
    const result = await flow.run(() => onConfirm?.());
    if (result.ok) flow.leave(onCancel);
  }
  const dismiss = () => flow.dismiss(onCancel);
</script>

<div class="layer oc-dialog-layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="oc-veil" onclick={dismiss} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="badge-icon"></span></span>
      <div class="titles">
        <span class="title">{t('ui.deleteGroupDialog.title', { noun })}</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="close" onclick={dismiss} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      <div class="copy">
        <span class="question"><Translate key="ui.deleteGroupDialog.question" params={{ noun }}>{#snippet name()}<span class="name">{groupName}</span>{/snippet}</Translate></span>
        <span class="text">{t('ui.deleteGroupDialog.warning', { noun })}</span>
      </div>
      <div class="field">
        <input class:armed bind:value={typed} placeholder={groupName} />
        <span class="hint">{t('ui.deleteGroupDialog.typeName', { noun })}</span>
      </div>
    </div>

    <div class="foot">
      <span class="cancel" onclick={dismiss} role="button" tabindex="0">{t('ui.deleteGroupDialog.keep', { noun })}</span>
      <span class="grow"></span>
      {#if flow.failed}<span class="error" role="alert">{t('ui.deleteGroupDialog.failed', { noun })}</span>{/if}
      <div class="delete" class:armed={armed && !flow.busy} onclick={confirm} role="button" tabindex="0" aria-disabled={!armed || flow.locked}>
        <span class="delete-icon"></span>
        <span>{t(flow.busy ? 'ui.deleteGroupDialog.deleting' : 'ui.common.delete')}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .layer {
    z-index: 70;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 480px;
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
    background: var(--btn-danger-bg);
    box-shadow: inset 0 0 0 1px var(--btn-danger-line);
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--status-danger);
    mask: var(--icon-trash) center/contain no-repeat;
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
    gap: var(--space-10);
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
    color: var(--status-danger);
  }

  .text {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    height: var(--control-xl);
    padding: 0 var(--space-14);
    border: none;
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
    outline: none;
  }

  input.armed {
    box-shadow: inset 0 0 0 1px var(--btn-danger-line);
  }

  .hint {
    padding-inline-start: var(--space-14);
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .error {
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--status-danger);
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

  .delete {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--btn-danger-bg);
    box-shadow: inset 0 0 0 1px var(--btn-danger-line);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--status-danger);
    cursor: not-allowed;
    user-select: none;
  }

  .delete.armed {
    background: var(--status-danger);
    box-shadow: inset 0 0 0 1px transparent;
    color: #1a0303;
    cursor: pointer;
  }

  .delete-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: var(--icon-trash) center/contain no-repeat;
  }
</style>
