<!-- Share something to one chat: pick → preview with optional message → Send.
     item: what is being shared. onSend({ chatId, chat, message }) fires on Send with the picked chat's id (and its name for
     display); the parent closes the picker and shows its own toast. -->
<script lang="ts">
  import Button from './Button.svelte';
  import DialogShell from './DialogShell.svelte';
  import Field from './Field.svelte';
  import IconButton from './IconButton.svelte';
  import TextArea from './TextArea.svelte';
  import { useT } from '../i18n';

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
    /** The host's id for the chat; passed back on Send. */
    id: string;
    name: string;
    kind?: string;
    /** Literal text under the name, in place of `kind` (a DM's last seen, a group's description). */
    sub?: string;
    /** Literal text, shown as given: the section it's listed under (Favourites, Direct chats, a community's name);
     *  chats of one section come together, and the list shows a header for each. */
    group?: string;
    grad: string;
    radius?: string;
  }

  interface Props {
    /** Resource key (or literal text). */
    title?: string;
    /** Resource key (or literal text). */
    sendLabel?: string;
    /** Resource key (or literal text). */
    previewLabel?: string;
    item?: Item | null;
    chats: Chat[];
    onSend?: (v: { chatId: string; chat: string; message: string }) => void;
    onClose?: () => void;
    z?: number;
    /** The host's search: the chats to list for a query (a name, a username, a community …); the picker otherwise
     *  matches `chats` by name and kind. */
    filter?: (query: string) => Chat[];
    /** Resource key (or literal text): what an empty list says when nothing is searched for. */
    emptyLabel?: string;
  }

  let {
    title = 'ui.chatPicker.title',
    sendLabel = 'ui.common.send',
    previewLabel = 'ui.chatPicker.sharing',
    item = null,
    chats,
    onSend,
    onClose,
    z = 90,
    filter,
    emptyLabel = 'ui.chatPicker.noChats',
  }: Props = $props();
  const t = useT();

  let query = $state('');
  let to = $state<Chat | null>(null);
  let message = $state('');

  const needle = $derived(query.trim().toLowerCase());
  const list = $derived(
    filter ? filter(query.trim()) : needle ? chats.filter((c) => `${c.name} ${c.kind ?? ''}`.toLowerCase().includes(needle)) : chats,
  );
  // whether the list is in sections (the host gave them): a header starts each, in place of "Recent chats"
  const sectioned = $derived(list.some((c) => c.group !== undefined));

  function pick(c: Chat) {
    to = c;
    message = '';
  }

  function send() {
    if (to) onSend?.({ chatId: to.id, chat: to.name, message: message.trim() });
  }
</script>

{#snippet tile()}
  <span
    class="item-tile"
    class:graded={!!item?.grad}
    style:border-radius={item?.round === false ? '10px' : 'var(--radius-pill)'}
    style:background={item?.grad || 'var(--overlay-2)'}
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
        <Field placeholder={t('ui.chatPicker.searchChats')} value={query} onInput={(e) => (query = e.currentTarget.value)} onClear={() => (query = '')} showShortcut={false} />
      </div>
      <div class="list" role="listbox" aria-label={t('ui.chatPicker.chats')}>
        {#if !sectioned}<span class="list-label">{t(needle ? 'ui.chatPicker.results' : 'ui.chatPicker.recentChats')}</span>{/if}
        {#each list as chat, i}
          {#if sectioned && chat.group !== list[i - 1]?.group}<span class="list-label">{chat.group}</span>{/if}
          <div class="chat" onclick={() => pick(chat)} role="option" aria-selected="false" tabindex="0">
            <span class="face" style:border-radius={chat.radius ?? '50%'} style:background={chat.grad}></span>
            <span class="chat-text"><span class="chat-name">{chat.name}</span><span class="chat-kind">{chat.sub ?? chat.kind ?? ''}</span></span>
            <span class="chevron" data-oc-flip=""></span>
          </div>
        {/each}
        {#if needle && list.length === 0}<span class="empty">{t('ui.chatPicker.noMatches', { query })}</span>
        {:else if list.length === 0}<span class="empty">{t(emptyLabel)}</span>{/if}
      </div>
    {:else}
      <div class="confirm">
        <div class="recipient">
          <IconButton variant="ghost" icon="back" label="ui.chatPicker.chooseAnother" onClick={() => (to = null)} />
          <span class="face" style:border-radius={to.radius ?? '50%'} style:background={to.grad}></span>
          <span class="chat-text"><span class="sending-to">{t('ui.chatPicker.sendingTo')}</span><span class="chat-name">{to.name}</span></span>
        </div>
        <div class="preview">
          <span class="preview-label">{t(previewLabel)}</span>
          <div class="item-row">
            {@render tile()}
            <span class="item-text"><span class="item-title wrap">{item?.title ?? ''}</span><span class="item-sub wrap">{item?.sub ?? ''}</span></span>
          </div>
        </div>
        <TextArea value={message} placeholder="ui.chatPicker.messagePlaceholder" help="" maxLength={500} minHeight={76} onInput={(e) => (message = e.currentTarget.value)} />
      </div>
      <div class="actions">
        <Button label="ui.common.back" variant="secondary" onClick={() => (to = null)} />
        <Button label={sendLabel} variant="primary" onClick={send} />
      </div>
    {/if}
  </div>
</DialogShell>

<style>
  .picker {
    min-height: 0;
    /* the shell's grid column would otherwise grow to a long unbroken line (a link) */
    min-width: 0;
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
    border-radius: var(--radius-md);
    background: var(--overlay-1);
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
    color: var(--ink-2);
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
    color: var(--ink);
  }

  .item-sub {
    font: var(--weight-regular) 12px/1.2 var(--font-mono);
    color: var(--ink-4);
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
    /* the host's section names (Group chats, a community's name) read as the design's labels */
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .chat {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .chat:hover {
    background: var(--overlay-1);
  }

  .face {
    flex: none;
    width: 36px;
    height: 36px;
  }

  .chat-name {
    font: var(--weight-semibold) var(--text-md) / 1.1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-kind,
  .sending-to {
    font: var(--weight-regular) 12px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-4);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .empty {
    padding: 24px 12px;
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
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
    color: var(--ink-4);
  }

  .actions {
    flex: none;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
    padding: var(--space-12) var(--space-16) var(--space-16);
    border-top: 1px solid var(--line-1);
  }
</style>
