<script lang="ts">
    import { Container } from "component-lib";
    import type {
        EventWrapper,
        Message,
        MultiUserChat,
        OpenChat,
        ReadonlySet,
    } from "openchat-client";
    import {
        currentUserStore,
        messagesRead,
        selectedChatPinnedMessagesStore,
        subscribe,
    } from "openchat-client";
    import { isSuccessfulEventsResponse, publish } from "openchat-shared";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import type { RemoteData } from "../../../utils/remoteData";
    import Loading from "../../Loading.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";

    interface Props {
        pinned: ReadonlySet<number>;
        chat: MultiUserChat;
    }

    let { pinned, chat }: Props = $props();
    void pinned;

    const client = getContext<OpenChat>("client");
    let unread = $state<boolean>(false);
    let pinnedMessages = $selectedChatPinnedMessagesStore;

    onMount(() => {
        const unsubs = [
            subscribe("chatWith", () => publish("closeModalPage")),
            messagesRead.subscribe(() => {
                unread = client.unreadPinned(chat.id, chat.dateLastPinned);
            }),
        ];
        return () => {
            unsubs.forEach((u) => u());
        };
    });

    let messagesDiv: HTMLDivElement | undefined = $state();

    let messages: RemoteData<EventWrapper<Message>[][], string> = $state({ kind: "idle" });

    function scrollBottom() {
        if (messagesDiv !== undefined) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                behavior: "auto",
            });
        }
    }

    function reloadPinned(pinned: ReadonlySet<number>): void {
        untrack(() => {
            if (pinned.size > 0) {
                if (messages.kind !== "success") {
                    messages = { kind: "loading" };
                }
                client
                    .getMessagesByMessageIndex(chat.id, undefined, pinned)
                    .then((resp) => {
                        if (!isSuccessfulEventsResponse(resp)) {
                            messages = { kind: "error", error: "Unable to load pinned messages" };
                        } else {
                            messages = {
                                kind: "success",
                                data: client.groupMessagesByDate(
                                    resp.events.sort((a, b) => a.index - b.index),
                                ),
                            };

                            if (unread) {
                                client.markPinnedMessagesRead(chat.id, chat.dateLastPinned!);
                            }

                            tick().then(scrollBottom);
                        }
                    })
                    .catch((err) => {
                        client.logError("Unable to load pinned messages: ", err);
                        messages = { kind: "error", error: err.toString() };
                    });
            } else {
                messages = { kind: "success", data: [] };
            }
        });
    }

    $effect(() => {
        reloadPinned(pinnedMessages);
        unread = client.unreadPinned(chat.id, chat.dateLastPinned);
    });

    function dateGroupKey(group: EventWrapper<Message>[]): string {
        const first = group[0] && group[0] && group[0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }
</script>

<SlidingPageContent title={i18nKey("pinnedMessages")}>
    <Container gap={"sm"} padding={"lg"} direction={"vertical"} bind:ref={messagesDiv}>
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
