<script lang="ts">
    import type { ChatSummary, MessageContext } from "@client";
    import ChatEventList from "./ChatEventList.svelte";
    import type { FlatChatItem } from "./flatChatItems";

    interface Props {
        chat: ChatSummary;
        items: FlatChatItem[];
        visible?: boolean;
    }

    let { chat: initialChat, items: initialItems, visible = true }: Props = $props();
    let chat = $state(initialChat);
    let items = $state(initialItems);
    let list: ChatEventList | undefined = $state();
    let initialised = $state(false);

    export function setItems(next: FlatChatItem[]) {
        items = next;
    }
    export function setChat(next: ChatSummary) {
        chat = next;
    }

    export function scrollToMessageIndex(context: MessageContext, index: number) {
        return list?.scrollToMessageIndex(context, index, false);
    }
    export function isInitialised() {
        return initialised;
    }
</script>

<ChatEventList
    bind:this={list}
    rootSelector="test"
    {chat}
    threadRootEvent={undefined}
    {items}
    readonly={false}
    maintainScroll={false}
    {visible}
    bind:initialised
>
    {#snippet row(item, { focusIndex })}
        {#if item.kind === "event" && item.event.event.kind === "message"}
            <div
                class="msg"
                data-index={item.event.event.messageIndex}
                data-focused={focusIndex === item.event.event.messageIndex ? "1" : undefined}
            >
                {item.event.event.messageIndex}
            </div>
        {/if}
    {/snippet}
</ChatEventList>
