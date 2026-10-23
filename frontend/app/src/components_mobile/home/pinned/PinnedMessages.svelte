<script lang="ts">
    import { Container } from "component-lib";
    import type {
        EventWrapper,
        Message,
        MultiUserChat,
        OpenChat,
        ReadonlySet,
    } from "@client";
    import {
        currentUserStore,
        subscribe,
    } from "@client";
    import { publish } from "@shared";
    import { PinnedMessages } from "@src/logic/pinned/pinnedMessages.svelte";
    import { getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Loading from "@shared_components/Loading.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";

    interface Props {
        pinned: ReadonlySet<number>;
        chat: MultiUserChat;
    }

    let { pinned, chat }: Props = $props();
    void pinned;

    const client = getContext<OpenChat>("client");
    const pinnedMessages = new PinnedMessages(
        client,
        () => chat.id,
        () => chat.dateLastPinned,
    );
    let messages = $derived(pinnedMessages.messages);

    onMount(() => {
        return subscribe("chatWith", () => publish("closeModalPage"));
    });

    let messagesDiv: HTMLDivElement | undefined = $state();

    function scrollBottom() {
        if (messagesDiv !== undefined) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                behavior: "auto",
            });
        }
    }

    $effect(() => {
        const loading = pinnedMessages.sync();
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

<SlidingPageContent title={i18nKey("pinnedMessages")}>
    <Container gap={"sm"} padding={"lg"} height={"fill"} direction={"vertical"} bind:ref={messagesDiv}>
        {#if messages.kind !== "success"}
            <Loading />
        {:else}
            {#each messages.data as dayGroup (dateGroupKey(dayGroup))}
                <Container gap={"sm"} direction={"vertical"}>
                    <div class="date-label">
                        {client.formatMessageDate(
                            dayGroup[0]?.timestamp,
                            $_("today"),
                            $_("yesterday"),
                        )}
                    </div>
                    {#each dayGroup as message (message.event.messageId)}
                        <PinnedMessage
                            chatId={chat.id}
                            timestamp={message.timestamp}
                            user={$currentUserStore}
                            senderId={message.event.sender}
                            msg={message.event} />
                    {/each}
                </Container>
            {/each}
        {/if}
    </Container>
</SlidingPageContent>

<style lang="scss">
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
</style>
