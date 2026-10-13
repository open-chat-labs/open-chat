<!-- Confirm deleting a group, channel or community: Delete arms only once the name is typed (case-insensitive).
     Cancel / confirm play the close animation, then call back. -->
<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    groupName: string;
    noun?: 'group' | 'channel' | 'community';
    onConfirm?: () => void;
    onCancel?: () => void;
  }

  let { groupName, noun = 'group', onConfirm, onCancel }: Props = $props();

  let typed = $state('');
  const armed = $derived(typed.trim().toLowerCase() === groupName.trim().toLowerCase());

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
</script>

<div class="layer" class:closing role="dialog" aria-modal="true">
  <div class="veil" onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="badge-icon"></span></span>
      <div class="titles">
        <span class="title">Delete a {noun}</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="close" onclick={() => close(onCancel)} role="button" tabindex="0"><span class="close-icon"></span></span>
    </div>

    <div class="body">
      <div class="copy">
        <span class="question">Delete the <span class="name">{groupName}</span> chat {noun}</span>
        <span class="text">Do you definitely want to delete this {noun}? All of your chat history will be lost, and this cannot be undone.</span>
      </div>
      <div class="field">
        <input class:armed bind:value={typed} placeholder={groupName} />
        <span class="hint">Type in the name of the {noun} to confirm delete</span>
      </div>
    </div>

    <div class="foot">
      <span class="cancel" onclick={() => close(onCancel)} role="button" tabindex="0">Keep my {noun}</span>
      <span class="grow"></span>
      <div class="delete" class:armed onclick={() => armed && close(onConfirm)} role="button" tabindex="0" aria-disabled={!armed}>
        <span class="delete-icon"></span>
        <span>Delete</span>
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
    max-width: 480px;
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
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(240, 68, 56, 0.5));
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--status-danger, #f5493d);
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
    gap: var(--space-10);
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
    color: var(--status-danger, #f5493d);
  }

  .text {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
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
    height: var(--control-xl, 44px);
    padding: 0 var(--space-14);
    border: none;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    outline: none;
  }

  input.armed {
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(240, 68, 56, 0.5));
  }

  .hint {
    padding-inline-start: var(--space-14);
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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

  .delete {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
    box-shadow: inset 0 0 0 1px var(--btn-danger-line, rgba(240, 68, 56, 0.5));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--status-danger, #f5493d);
    cursor: not-allowed;
    user-select: none;
  }

  .delete.armed {
    background: var(--status-danger, #f5493d);
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
