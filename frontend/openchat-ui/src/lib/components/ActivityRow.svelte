<!-- One activity feed entry: avatar, title, where it happened, optional preview and reactions, time and unread dot.
     Channels and groups read as squircles, people as circles.
     By hand (web L3, TODO(design)): `avatarUrl`, the person's picture over the colour, and `tips`, a tip's chips (the
     token's logo and the total, as ReactionChips' tips) before the reactions, the first four then "+N". -->
<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { useT } from '../i18n';
  import { foldTips, type ActivityTip } from '../activityFeed.svelte';

  interface Props {
    title: string;
    /** Where it happened, e.g. "OpenChat Labs / Engineering". */
    context: string;
    preview?: string;
    time: string;
    unread?: boolean;
    color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
    /** The person's own picture, over `color` (which shows while it loads, and without one). */
    avatarUrl?: string;
    kind?: 'user' | 'group';
    reactions?: string[];
    /** The tips the message got, a chip per token before the reactions: the first four, then "+N". */
    tips?: ActivityTip[];
    onClick?: () => void;
  }

  let { title, context, preview = '', time, unread = false, color = 'violet', avatarUrl, kind = 'user', reactions = [], tips = [], onClick }: Props = $props();
  const t = useT();
  const tipChips = $derived(foldTips(tips));
</script>

<div class="row" onclick={onClick} role="button" tabindex="0">
  <div class="avatar"><Avatar size={36} shape={kind === 'group' ? 'squircle' : 'circle'} {color} url={avatarUrl} online={false} /></div>
  <div class="main">
    <span class="title">{title}</span>
    <span class="context">{context}</span>
    {#if preview}
      <span class="preview">{preview}</span>
    {/if}
    {#if tips.length > 0}
      <div class="tips">
        {#each tipChips.shown as tip}
          <span class="tip" title={tip.label}
            ><span class="coin" style:background={tip.logo} aria-hidden="true"></span>{tip.amount} {tip.symbol}</span
          >
        {/each}
        {#if tipChips.more > 0}
          <span class="tip more">+{tipChips.more}</span>
        {/if}
      </div>
    {/if}
    {#if reactions.length > 0}
      <div class="reactions">
        {#each reactions as r}
          <span class="reaction">{r}</span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="side">
    <span class="time">{time}</span>
    {#if unread}
      <span class="dot" title={t('ui.activityRow.unread')}></span>
    {/if}
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .row {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    gap: var(--space-10);
    padding: var(--space-10) var(--space-8);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;

    &:hover {
      background: var(--overlay-1);
    }
  }

  .avatar {
    flex: none;
    display: flex;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .context,
  .preview {
    @include truncate;
  }

  .context {
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--accent);
  }

  .preview {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
  }

  .reactions {
    display: flex;
    gap: var(--space-4);
    padding-block-start: var(--space-6);
  }

  .reaction {
    @include flex-center;
    min-width: 24px;
    height: 24px;
    padding: 0 var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .tips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    min-width: 0;
    padding-block-start: var(--space-6);
  }

  .tip {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    /* grows with the text scale (L4) rather than clipping it */
    min-height: 24px;
    padding: var(--space-4) var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .coin {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }

  .side {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-8);
  }

  .time {
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
    white-space: nowrap;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }
</style>
