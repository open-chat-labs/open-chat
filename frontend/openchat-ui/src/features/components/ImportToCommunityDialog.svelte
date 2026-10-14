<!-- Import a group into a community you own, as a channel: pick a community → confirm (irreversible warning).
     onConfirm(community) gets the picked community (with its id) and is awaited: the dialog shows "Importing…", closes once
     it resolves and stays on the confirm step with an error if it rejects. It can't be dismissed while importing.
     Success contract (same in every confirm/create dialog): once the host's promise resolves the dialog animates out and
     then calls onCancel, so the host unmounts it; it stays hidden (no reappearing, no invisible layer catching clicks). -->
<script lang="ts" module>
  export interface ImportCommunity {
    id: string;
    name: string;
    /** Avatar image URL; falls back to a gradient. */
    avatarUrl?: string;
    members: number;
    channels: number;
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { segments, useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';

  const GRADIENTS = ['linear-gradient(140deg,#ff8a5f,#b3407a)', 'linear-gradient(140deg,#5fa8ff,#8c6bff)', 'linear-gradient(140deg,#2ee6a8,#1fb6ff)'];

  type Community = ImportCommunity;

  interface Props {
    groupName: string;
    /** Communities you own. */
    communities: Community[];
    /** Import the group into this community. Reject to keep the dialog open with an error. */
    onConfirm?: (community: ImportCommunity) => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let { groupName, communities, onConfirm, onCancel }: Props = $props();

  const t = useT();
  const meta = (c: Community) => t('ui.importToCommunityDialog.meta', { members: c.members, channels: c.channels });

  let target = $state<{ community: Community; gradient: string } | null>(null);

  let closing = $state(false);
  let importing = $state(false);
  let failed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  // play the exit animation, then hand control back
  function close(then?: () => void) {
    if (closing || importing) return;
    closing = true;
    timer = setTimeout(() => then?.(), 170);
  }

  async function confirm() {
    if (!target || importing) return;
    importing = true;
    failed = false;
    try {
      await onConfirm?.(target.community);
    } catch {
      failed = true;
      return;
    } finally {
      importing = false;
    }
    // success: animate out, then hand back to the host (see the header)
    close(onCancel);
  }

  const avatarOf = (c: Community, i: number) => (c.avatarUrl ? `url(${c.avatarUrl}) center/cover no-repeat` : GRADIENTS[i % GRADIENTS.length]);
</script>

<div class="layer" class:closing role="dialog" aria-modal="true" use:modal={closing ? undefined : () => close(onCancel)}>
  <div class="veil" onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      {#if target}
        <span
          class="icon-button"
          onclick={() => {
            if (importing) return;
            target = null;
            failed = false;
          }}
          role="button"
          tabindex="0"
          aria-label={t('ui.common.back')}><span class="back-icon"></span></span>
      {:else}
        <span class="badge"><span class="badge-icon import"></span></span>
      {/if}
      <div class="titles">
        <span class="title">{t('ui.importToCommunityDialog.title')}</span>
        <span class="subtitle">{groupName}</span>
      </div>
      <span class="icon-button" onclick={() => close(onCancel)} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if !target}
        <div class="stack">
          <div class="copy">
            <span class="headline">{#each segments(t, 'ui.importToCommunityDialog.headline', ['group']) as seg}{#if 'slot' in seg}<span class="accent">{groupName}</span>{:else}{#each seg.text.split('\n') as line, li}{#if li}<br />{/if}{line}{/each}{/if}{/each}</span>
            <span class="lead"
              ><Translate key="ui.importToCommunityDialog.lead">{#snippet channel()}<span class="strong">{t('ui.importToCommunityDialog.channelWord')}</span>{/snippet}</Translate></span
            >
          </div>
          <div class="pick">
            <span class="pick-label">{t('ui.importToCommunityDialog.selectCommunity', { count: communities.length })}</span>
            <div class="list">
              {#each communities as community, i}
                {@const gradient = avatarOf(community, i)}
                <div class="community" onclick={() => (target = { community, gradient })} role="button" tabindex="0">
                  <span class="avatar" style:background={gradient}></span>
                  <div class="names">
                    <span class="name">{community.name}</span>
                    <span class="meta">{meta(community)}</span>
                  </div>
                  <span class="chevron"></span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <div class="stack">
          <div class="copy">
            <span class="headline">{t('ui.importToCommunityDialog.confirmHeadline')}</span>
            <span class="lead"
              ><Translate key="ui.importToCommunityDialog.confirmLead"
                >{#snippet group()}<span class="strong accent">{groupName}</span>{/snippet}{#snippet community()}<span class="strong accent">{target!.community.name}</span>{/snippet}</Translate
              ></span
            >
          </div>
          <div class="cards">
            <div class="community selected">
              <span class="avatar" style:background={target.gradient}></span>
              <div class="names">
                <span class="name">{target.community.name}</span>
                <span class="meta">{meta(target.community)}</span>
              </div>
            </div>
            <div class="notice warn">
              <div class="notice-head"><span class="notice-icon"></span><span class="notice-title">{t('ui.importToCommunityDialog.irreversible')}</span></div>
              <span class="notice-text">{t('ui.importToCommunityDialog.irreversibleText')}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="foot">
      <span class="text-button" onclick={() => close(onCancel)} role="button" tabindex="0" aria-disabled={importing}>{t('ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if failed}
        <span class="error" role="alert">{t('ui.importToCommunityDialog.failed')}</span>
      {/if}
      {#if target}
        <div class="primary" class:busy={importing} onclick={confirm} role="button" tabindex="0" aria-disabled={importing}>
          <span class="primary-icon import"></span>
          <span>{t(importing ? 'ui.importToCommunityDialog.importing' : 'ui.importToCommunityDialog.proceed')}</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
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
    max-width: 520px;
  }

  .import {
    mask: var(--icon-import) center/contain no-repeat;
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .strong {
    font-weight: var(--weight-semibold);
    color: var(--ink, #e4e4ec);
  }

  .strong.accent {
    color: var(--accent-bright, #ff8298);
  }

  .pick {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .pick-label {
    padding-inline-start: var(--space-14);
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .community {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
    cursor: pointer;
  }

  .community:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .community.selected {
    width: auto;
    padding: var(--space-12);
    min-width: 0;
    cursor: auto;
  }

  .community.selected:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }
</style>
