<!-- Share something to one chat: pick → preview with optional message → Send.
     item: what is being shared. onSend({ chat, message }) fires on Send; the parent closes the picker and shows its own toast. -->
<script lang="ts">
  import Button from './Button.svelte';
  import DialogShell from './DialogShell.svelte';
  import Field from './Field.svelte';
  import IconButton from './IconButton.svelte';
  import TextArea from './TextArea.svelte';

  interface Item {
    title: string;
    sub?: string;
    /** Text mark in the tile, when there is no icon. */
    mark?: string;
    icon?: string;
    /** Tile background; neutral when absent. */
    grad?: string;
    /** false = rounded square tile. */
    round?: boolean;
  }

  interface Chat {
    name: string;
    kind?: string;
    grad: string;
    radius?: string;
  }

  interface Props {
    title?: string;
    sendLabel?: string;
    previewLabel?: string;
    item?: Item | null;
    chats: Chat[];
    onSend?: (v: { chat: string; message: string }) => void;
    onClose?: () => void;
    z?: number;
  }

  let { title = 'Share to chat', sendLabel = 'Send', previewLabel = 'SHARING', item = null, chats, onSend, onClose, z = 90 }: Props = $props();

  let query = $state('');
  let to = $state<Chat | null>(null);
  let message = $state('');

  const needle = $derived(query.trim().toLowerCase());
  const list = $derived(needle ? chats.filter((c) => `${c.name} ${c.kind ?? ''}`.toLowerCase().includes(needle)) : chats);

  function pick(c: Chat) {
    to = c;
    message = '';
  }

  function send() {
    if (to) onSend?.({ chat: to.name, message: message.trim() });
  }
</script>

{#snippet tile()}
  <span
    class="item-tile"
    class:graded={!!item?.grad}
    style:border-radius={item?.round === false ? '10px' : 'var(--radius-pill)'}
    style:background={item?.grad || 'var(--overlay-2,rgba(255,255,255,.08))'}
  >
    {#if item?.icon}<span class="item-icon" style:mask="var(--icon-{item.icon}) center/contain no-repeat"></span>{:else}{item?.mark ?? ''}{/if}
  </span>
{/snippet}

<DialogShell {title} width={460} height="min(600px,100%)" flush={true} {z} {onClose}>
  <div class="picker">
    {#if !to}
      <div class="top">
        {#if item}
          <div class="item">
            {@render tile()}
            <span class="item-text"><span class="item-title clip">{item.title}</span><span class="item-sub clip">{item.sub ?? ''}</span></span>
          </div>
        {/if}
        <Field placeholder="Search chats" value={query} onInput={(e) => (query = e.currentTarget.value)} onClear={() => (query = '')} showShortcut={false} />
      </div>
      <div class="list" role="listbox" aria-label="Chats">
        <span class="list-label">{needle ? 'RESULTS' : 'RECENT CHATS'}</span>
        {#each list as chat}
          <div class="chat" onclick={() => pick(chat)} role="option" aria-selected="false" tabindex="0">
            <span class="face" style:border-radius={chat.radius ?? '50%'} style:background={chat.grad}></span>
            <span class="chat-text"><span class="chat-name">{chat.name}</span><span class="chat-kind">{chat.kind ?? ''}</span></span>
            <span class="chevron" data-oc-flip=""></span>
          </div>
        {/each}
        {#if needle && list.length === 0}<span class="empty">No chats match “{query}”.</span>{/if}
      </div>
    {:else}
      <div class="confirm">
        <div class="recipient">
          <IconButton variant="ghost" icon="back" label="Choose another chat" onClick={() => (to = null)} />
          <span class="face" style:border-radius={to.radius ?? '50%'} style:background={to.grad}></span>
          <span class="chat-text"><span class="sending-to">Sending to</span><span class="chat-name">{to.name}</span></span>
        </div>
        <div class="preview">
          <span class="preview-label">{previewLabel}</span>
          <div class="item-row">
            {@render tile()}
            <span class="item-text"><span class="item-title wrap">{item?.title ?? ''}</span><span class="item-sub wrap">{item?.sub ?? ''}</span></span>
          </div>
        </div>
        <TextArea value={message} placeholder="Add a message (optional)" help="" maxLength={500} minHeight={76} onInput={(e) => (message = e.currentTarget.value)} />
      </div>
      <div class="actions">
        <Button label="Back" variant="secondary" onClick={() => (to = null)} />
        <Button label={sendLabel} variant="primary" onClick={send} />
      </div>
    {/if}
  </div>
</DialogShell>

<style>
  .picker {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .top {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-16) var(--space-8);
  }

  .item,
  .preview {
    padding: var(--space-12) var(--space-14);
    border-radius: var(--radius-md, 12px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .item,
  .item-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .item-tile {
    flex: none;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 14px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .item-tile.graded {
    color: #0b0b10;
  }

  .item-icon {
    display: block;
    width: 16px;
    height: 16px;
    background: currentColor;
  }

  .item-text,
  .chat-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .item-title {
    font: var(--weight-semibold) 13.5px/1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .item-sub {
    font: var(--weight-regular) 12px/1.2 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .clip {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wrap {
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-4) var(--space-10) var(--space-16);
  }

  .list-label {
    padding: 10px 8px 8px;
    font: var(--weight-semibold) 11.5px/1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #8a8a99);
  }

  .chat {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-md, 12px);
    cursor: pointer;
  }

  .chat:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .face {
    flex: none;
    width: 36px;
    height: 36px;
  }

  .chat-name {
    font: var(--weight-semibold) var(--text-md) / 1.1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-kind,
  .sending-to {
    font: var(--weight-regular) 12px/1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4, #8a8a99);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .empty {
    padding: 24px 12px;
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .confirm {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-16);
  }

  .recipient {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .preview-label {
    font: var(--weight-semibold) 11px/1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #8a8a99);
  }

  .actions {
    flex: none;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-16) var(--space-16);
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }
</style>
