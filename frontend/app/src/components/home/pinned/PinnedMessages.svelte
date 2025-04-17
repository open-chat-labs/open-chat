<script lang="ts">
    import type { EventWrapper, Message, MultiUserChatIdentifier, OpenChat } from "openchat-client";
    import { messagesRead, subscribe, ui, currentUser as user } from "openchat-client";
    import { isSuccessfulEventsResponse } from "openchat-shared";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import type { RemoteData } from "../../../utils/remoteData";
    import HoverIcon from "../../HoverIcon.svelte";
    import Loading from "../../Loading.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";

    interface Props {
        pinned: Set<number>;
        chatId: MultiUserChatIdentifier;
        dateLastPinned: bigint | undefined;
        onClose: () => void;
    }

    let { pinned, chatId, dateLastPinned, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    onMount(() => {
        return subscribe("chatWith", (_) => {
            onClose();
        });
    });

    let unread: boolean = $state(false);
    let messagesDiv: HTMLDivElement | undefined = $state();

    let messages: RemoteData<EventWrapper<Message>[][], string> = $state({ kind: "idle" });

    function close() {
        onClose();
        messages = { kind: "idle" };
    }

    function scrollBottom() {
        if (messagesDiv !== undefined) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight - messagesDiv.clientHeight,
                behavior: "auto",
            });
        }
    }

    function reloadPinned(pinned: Set<number>): void {
        untrack(() => {
            if (pinned.size > 0) {
                if (messages.kind !== "success") {
                    messages = { kind: "loading" };
                }
                client
                    .getGroupMessagesByMessageIndex(chatId, pinned)
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
                                client.markPinnedMessagesRead(chatId, dateLastPinned!);
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
        reloadPinned(pinned);
        unread = client.unreadPinned(chatId, dateLastPinned);
    });

    function dateGroupKey(group: EventWrapper<Message>[]): string {
        const first = group[0] && group[0] && group[0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    onMount(() => {
        return messagesRead.subscribe(() => {
            unread = client.unreadPinned(chatId, dateLastPinned);
        });
    });
</script>

<SectionHeader gap>
    <h4><Translatable resourceKey={i18nKey("pinnedMessages")} /></h4>
    <span title={$_("close")} class="close" onclick={close}>
        <HoverIcon>
            <Close size={ui.iconSize} color={"var(--icon-txt)"} />
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
                        user={$user}
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
