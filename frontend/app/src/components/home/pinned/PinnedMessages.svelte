<script lang="ts">
    import type {
        EventWrapper,
        Message,
        MultiUserChatIdentifier,
        OpenChat,
        ReadonlySet,
    } from "@client";
    import {
        currentUserStore,
        iconSize,
        subscribe,
    } from "@client";
    import { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import Loading from "@shared_components/Loading.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";

    interface Props {
        pinned: ReadonlySet<number>;
        chatId: MultiUserChatIdentifier;
        dateLastPinned: bigint | undefined;
        onClose: () => void;
    }

    let { chatId, dateLastPinned, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    const pinned = new PinnedMessages(
        client,
        () => chatId,
        () => dateLastPinned,
    );
    let messages = $derived(pinned.messages);

    onMount(() => {
        return subscribe("chatWith", onClose);
    });

    // bind:this sets this to null when the panel unmounts, which can happen
    // before the tick() after a load resolves (Rollbar #31953).
    let messagesDiv: HTMLDivElement | null | undefined = $state();

    function close() {
        onClose();
    }

    function scrollBottom() {
        if (messagesDiv) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                behavior: "auto",
            });
        }
    }

    $effect(() => {
        const loading = pinned.sync();
        void (async () => {
            if (await loading) {
                await tick();
                scrollBottom();
            }
        })();
    });

    function dateGroupKey(group: EventWrapper<Message>[]): string {
        const first = group[0] && group[0] && group[0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }
</script>

<SectionHeader gap>
    <h4><Translatable resourceKey={i18nKey("pinnedMessages")} /></h4>
    <span title={$_("close")} class="close" onclick={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div bind:this={messagesDiv} class="pinned-messages">
    {#if messages.kind !== "success"}
        <Loading />
    {:else}
        {#each messages.data as dayGroup (dateGroupKey(dayGroup))}
            <div class="day-group">
                <div class="date-label">
                    {client.formatMessageDate(dayGroup[0]?.timestamp, $_("today"), $_("yesterday"))}
                </div>
                {#each dayGroup as message (message.event.messageId)}
                    <PinnedMessage
                        {chatId}
                        timestamp={message.timestamp}
                        user={$currentUserStore}
                        senderId={message.event.sender}
                        msg={message.event} />
                {/each}
            </div>
        {/each}
    {/if}
</div>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0 $sp3;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
    .pinned-messages {
        @include message-list();
    }

    .day-group {
        position: relative;

        .date-label {
            padding: $sp2;
            background-color: var(--currentChat-date-bg);
            border: var(--currentChat-date-bd);
            color: var(--currentChat-date-txt);
            position: sticky;
            top: 0;
            width: 200px;
            margin: 0 auto;
            border-radius: $sp4;
            @include z-index("date-label");
            @include font(book, normal, fs-70);
            text-align: center;
            margin-bottom: $sp4;
        }
    }
</style>
