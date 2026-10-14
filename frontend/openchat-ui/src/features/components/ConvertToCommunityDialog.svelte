<!-- Convert a group into a community: confirm (irreversible warning + what the conversion does) → done.
     Confirm calls onConfirm and moves to the done step locally; a new `step` from the parent takes over again.
     Finish falls back to onCancel; "Go to the community" falls back to onFinish, then onCancel. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';

  const STEPS = [
    'Freeze the existing group',
    'Create a new community with the same name as the group',
    'Add a public channel to the community with the same name as the group',
    'Add all members of the group as members of the community',
    'Copy the full message history from the group into the channel',
    'Delete the existing group and inform its members that it has been converted',
  ];

  interface Props {
    groupName: string;
    step?: 'confirm' | 'done';
    onConfirm?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onGoTo?: () => void;
  }

  let { groupName, step = 'confirm', onConfirm, onCancel, onFinish, onGoTo }: Props = $props();

  // confirming shows the done step until the parent sends a new step
  let current = $derived(step);

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

  function confirm() {
    onConfirm?.();
    current = 'done';
  }
</script>

<div class="layer" class:closing role="dialog" aria-modal="true" use:modal={() => close(onCancel)}>
  <div class="veil" onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="badge-icon community"></span></span>
      <div class="titles">
        <span class="title">Convert to community</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="icon-button" onclick={() => close(onCancel)} role="button" tabindex="0"><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if current !== 'done'}
        <div class="stack">
          <div class="copy">
            <span class="headline">Convert <span class="accent">{groupName}</span><br />into a community</span>
            <span class="lead">We take care of the whole conversion for you — the group keeps its name, members and history.</span>
          </div>

          <div class="cards">
            <div class="notice warn">
              <div class="notice-head"><span class="notice-icon"></span><span class="notice-title">This is irreversible</span></div>
              <span class="notice-text">Converting a group into a community cannot be undone. Make sure you are okay with this before proceeding.</span>
            </div>

            <div class="steps">
              <span class="steps-label">CONVERSION WILL DO THE FOLLOWING</span>
              <div class="step-list">
                {#each STEPS as label}
                  <div class="step"><span class="step-check"></span><span class="step-label">{label}</span></div>
                {/each}
              </div>
            </div>
          </div>

          <span class="patience">This might take a few minutes depending on the size of the group, so please be patient.</span>
        </div>
      {:else}
        <div class="stack">
          <div class="copy">
            <span class="headline"><span class="accent">{groupName}</span> successfully converted into a community!</span>
            <span class="lead">Your group is now available as a community, and you may start adding more channels and more members.</span>
          </div>
          <div class="notice tip">
            <div class="notice-head"><span class="notice-icon"></span><span class="notice-title">Consolidate your other groups</span></div>
            <span class="notice-text">If you have more groups you'd like to bring together, you can import them into any community you own as channels.</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="foot">
      {#if current !== 'done'}
        <span class="text-button" onclick={() => close(onCancel)} role="button" tabindex="0">Cancel</span>
        <span class="grow"></span>
        <div class="primary" onclick={confirm} role="button" tabindex="0">
          <span class="primary-icon community"></span>
          <span>Convert to community</span>
        </div>
      {:else}
        <span class="text-button" onclick={() => close(onFinish ?? onCancel)} role="button" tabindex="0">Finish</span>
        <span class="grow"></span>
        <div class="primary" onclick={() => close(onGoTo ?? onFinish ?? onCancel)} role="button" tabindex="0">
          <span>Go to the community</span>
          <span class="primary-icon arrow"></span>
        </div>
      {/if}
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
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .badge-icon {
    width: 19px;
    height: 19px;
    background: var(--accent, #ff5672);
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
    text-wrap: pretty;
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .lead {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .accent {
    color: var(--accent-bright, #ff8298);
  }

  .notice {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-16) var(--space-16);
    border-radius: var(--radius-lg);
  }

  .notice.warn {
    background: var(--status-chit-soft, rgba(255, 159, 69, 0.14));
    box-shadow: inset 0 0 0 1px var(--status-chit, #ff9f45);
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
    background: var(--status-chit, #ff9f45);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .notice-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .notice-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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

  .text-button {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .text-button:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
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
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
    user-select: none;
  }

  .primary:hover {
    background: var(--accent-hover, #ff6d85);
  }

  .primary-icon {
    width: 16px;
    height: 16px;
    background: var(--on-accent, #2e0512);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .steps-label {
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
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
    background: var(--accent, #ff5672);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .step-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    text-wrap: pretty;
  }

  .patience {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-align: center;
    text-wrap: pretty;
  }

  .notice.tip {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .tip .notice-icon {
    background: var(--accent-bright, #ff8298);
    mask: var(--icon-info) center/contain no-repeat;
  }
</style>
