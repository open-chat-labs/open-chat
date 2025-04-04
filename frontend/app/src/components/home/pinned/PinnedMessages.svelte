<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type { EventWrapper, Message, MultiUserChatIdentifier, OpenChat } from "openchat-client";
    import { currentUser as user, messagesRead } from "openchat-client";
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import type { RemoteData } from "../../../utils/remoteData";
    import Loading from "../../Loading.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { subscribe } from "@src/utils/pubsub";

    export let pinned: Set<number>;
    export let chatId: MultiUserChatIdentifier;
    export let dateLastPinned: bigint | undefined;

    const client = getContext<OpenChat>("client");

    onMount(() => {
        return subscribe("chatWith", (_) => {
            dispatch("close");
        });
    });

    let unread: boolean = false;
    let messagesDiv: HTMLDivElement | undefined;

    let messages: RemoteData<EventWrapper<Message>[][], string> = { kind: "idle" };

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
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
        if (pinned.size > 0) {
            if (messages.kind !== "success") {
                messages = { kind: "loading" };
            }
            client
                .getGroupMessagesByMessageIndex(chatId, pinned)
                .then((resp) => {
                    if (resp === "events_failed") {
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
    }

    $: {
        reloadPinned(pinned);
        unread = client.unreadPinned(chatId, dateLastPinned);
    }

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
    <span title={$_("close")} class="close" on:click={close}>
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
                        user={$user}
                        senderId={message.event.sender}
                        msg={message.event}
                        on:goToMessageIndex />
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
