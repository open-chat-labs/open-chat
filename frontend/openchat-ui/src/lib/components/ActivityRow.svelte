<!-- One activity feed entry: avatar, title, where it happened, optional preview and reactions, time and unread dot.
     Channels and groups read as squircles, people as circles. -->
<script lang="ts">
  import Avatar from './Avatar.svelte';

  interface Props {
    title: string;
    /** Where it happened, e.g. "OpenChat Labs / Engineering". */
    context: string;
    preview?: string;
    time: string;
    unread?: boolean;
    color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
    kind?: 'user' | 'group';
    reactions?: string[];
    onClick?: () => void;
  }

  let { title, context, preview = '', time, unread = false, color = 'violet', kind = 'user', reactions = [], onClick }: Props = $props();
</script>

<div class="row" class:unread onclick={onClick} role="button" tabindex="0">
  <div class="avatar"><Avatar size={36} shape={kind === 'group' ? 'squircle' : 'circle'} {color} online={false} /></div>
  <div class="main">
    <span class="title">{title}</span>
    <span class="context">{context}</span>
    {#if preview}
      <span class="preview">{preview}</span>
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
      <span class="dot" title="Unread"></span>
    {/if}
  </div>
</div>

<style>
  .row {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    gap: var(--space-10);
    padding: var(--space-10) var(--space-8);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }

  .row.unread {
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
  }

  .row:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
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
    color: var(--ink, #ececf1);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .context,
  .preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context {
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .preview {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .reactions {
    display: flex;
    gap: var(--space-4);
    padding-block-start: var(--space-6);
  }

  .reaction {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
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
    color: var(--ink-4, #6e6e7c);
    white-space: nowrap;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
  }
</style>
