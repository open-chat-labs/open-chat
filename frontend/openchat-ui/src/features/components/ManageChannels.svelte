<!-- Manage's Channels page for a community: its channels, each opening that channel's Manage, and New channel.
     A title bar (Channels, New channel, close) over a list of channel cards: a round # avatar, the name with a
     "You're here" chip on the open one, its description, and its members and visibility. Built by hand from the App
     prototype's Manage dialog (its Channels section); the design export has no component for it. -->
<script lang="ts" module>
  export interface ManageChannel {
    key: string;
    title: string;
    /** Its description (or literal text such as "Embedded app"). */
    sub: string;
    /** e.g. "1,204 · Public". */
    meta: string;
    /** Avatar gradient: violet | rose | blue | amber | teal | plum | slate. */
    color?: string;
    /** The channel that's open now. */
    current?: boolean;
  }

  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#8B7BFF,#5B3FD9)',
    rose: 'linear-gradient(140deg,#FF8FA8,#E0456A)',
    blue: 'linear-gradient(140deg,#5CB8FF,#2F6BFF)',
    amber: 'linear-gradient(140deg,#FFC061,#F58A2E)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FA6B8)',
    plum: 'linear-gradient(140deg,#E27BFF,#9B3FD9)',
    slate: 'linear-gradient(140deg,#9AA3B5,#5D6678)',
  };
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import IconButton from '../../lib/components/IconButton.svelte';

  interface Props {
    channels: ManageChannel[];
    onSelect: (key: string) => void;
    /** Shows New channel. */
    onNew?: () => void;
    onClose: () => void;
  }

  let { channels, onSelect, onNew, onClose }: Props = $props();
  const t = useT();

  const keys = (fn?: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn?.();
    }
  };
</script>

<div class="page">
  <div class="head">
    <span class="title">{t('ui.manageChannels.title')}</span>
    {#if onNew}
      <div class="new" onclick={onNew} onkeydown={keys(onNew)} role="button" tabindex="0"><span class="plus"></span>{t('ui.manageChannels.newChannel')}</div>
    {/if}
    <div class="close"><IconButton label="ui.common.close" icon="close" onClick={onClose} /></div>
  </div>
  <div class="list">
    {#each channels as c (c.key)}
      <div class="row" onclick={() => onSelect(c.key)} onkeydown={keys(() => onSelect(c.key))} role="button" tabindex="0">
        <span class="avatar" style:background={GRADIENTS[c.color ?? 'teal'] ?? GRADIENTS.teal}>#</span>
        <div class="text">
          <div class="name-line">
            <span class="name">{c.title}</span>
            {#if c.current}<span class="here">{t('ui.manageChannels.youreHere')}</span>{/if}
          </div>
          <span class="sub">{t(c.sub)}</span>
        </div>
        <span class="meta">{c.meta}</span>
        <span class="chevron" data-oc-flip></span>
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 71px;
    box-sizing: border-box;
    padding: 0 var(--space-16) 0 var(--space-24);
    border-bottom: 1px solid var(--line-1);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .new {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px 0 10px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .new:hover {
    background: var(--btn-hover);
  }

  .plus {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .close {
    flex: none;
    display: flex;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-16) var(--space-24) var(--space-32);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background: var(--overlay-2);
  }

  .avatar {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: var(--weight-semibold) 16px / 1 var(--font-mono);
    color: #fff;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .name,
  .sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name {
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .here {
    flex: none;
    padding: 4px 7px;
    border-radius: var(--radius-pill);
    background: var(--accent-soft);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--accent);
  }

  .sub {
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .meta {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .chevron {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-4);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }
</style>
