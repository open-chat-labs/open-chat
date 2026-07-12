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
        messagesRead,
        selectedChatPinnedMessagesStore,
        selectedServerChatStore,
        subscribe,
    } from "@client";
    import { isSuccessfulEventsResponse, publish } from "@shared";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "@src/i18n/i18n";
    import type { RemoteData } from "@src/utils/remoteData";
    import Loading from "@src/ui/Loading.svelte";
    import SlidingPageContent from "@src/mobile/shared/SlidingPageContent.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";

    interface Props {
        pinned: ReadonlySet<number>;
        chat: MultiUserChat;
    }

    let { pinned, chat }: Props = $props();
    void pinned;

    const client = getContext<OpenChat>("client");
    let unread = $state<boolean>(false);
    // $derived is load-bearing: a plain `let` captures a one-time snapshot,
    // and if the panel mounts before the chat details (pinned set) arrive
    // the panel stays empty forever.
    let pinnedMessages = $derived($selectedChatPinnedMessagesStore);

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
                    .getMessagesByMessageIndex(chat.id, undefined, [...pinned])
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
        // Until the chat details arrive the pinned set is UNKNOWN, not empty —
        // rendering the empty state here made the panel show "no pins" for the
        // first second on a first open (cold cache / slow connection).
        if ($selectedServerChatStore === undefined) {
            messages = { kind: "loading" };
            return;
        }
        reloadPinned(pinnedMessages);
        unread = client.unreadPinned(chat.id, chat.dateLastPinned);
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
