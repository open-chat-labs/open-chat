<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type { EventWrapper, Message } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { logger } from "../../../utils/logging";
    import type { RemoteData } from "../../../utils/remoteData";
    import Loading from "../../Loading.svelte";
    import PinnedMessage from "./PinnedMessage.svelte";
    import type { OpenChat } from "openchat-client";

    export let pinned: Set<number>;
    export let chatId: string;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    let messages: RemoteData<EventWrapper<Message>[][], string> = { kind: "idle" };

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function chatWith(ev: CustomEvent<string>) {
        dispatch("close");
        dispatch("chatWith", ev.detail);
    }

    $: serverChatSummariesStore = client.serverChatSummariesStore;
    $: {
        if (pinned.size > 0) {
            messages = { kind: "loading" };
            client.api
                .getGroupMessagesByMessageIndex(
                    chatId,
                    pinned,
                    $serverChatSummariesStore[chatId]?.latestEventIndex
                )
                .then((resp) => {
                    if (resp === "events_failed") {
                        messages = { kind: "error", error: "Unable to load pinned messages" };
                    } else {
                        messages = {
                            kind: "success",
                            data: client
                                .groupMessagesByDate(resp.events.sort((a, b) => a.index - b.index))
                                .reverse(),
                        };
                    }
                })
                .catch((err) => {
                    logger.error("Unable to load pinned messages: ", err);
                    messages = { kind: "error", error: err.toString() };
                });
        } else {
            messages = { kind: "success", data: [] };
        }
    }

    function dateGroupKey(group: EventWrapper<Message>[]): string {
        const first = group[0] && group[0] && group[0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }
</script>

<SectionHeader flush={true}>
    <h4>{$_("pinnedMessages")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="pinned-messages">
    {#if messages.kind !== "success"}
        <Loading />
    {:else}
        {#each messages.data as dayGroup, _di (dateGroupKey(dayGroup))}
            <div class="day-group">
                <div class="date-label">
                    {client.formatMessageDate(dayGroup[0]?.timestamp, $_("today"), $_("yesterday"))}
                </div>
                {#each dayGroup as message, _i (message.event.messageId)}
                    <PinnedMessage
                        {chatId}
                        {user}
                        senderId={message.event.sender}
                        msg={message.event}
                        on:chatWith={chatWith}
                        on:goToMessageIndex />
                {/each}
            </div>
        {/each}
    {/if}
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
    .pinned-messages {
        flex: auto;
        background-color: var(--panel-bg);
        padding: $sp3 $sp3;
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        position: relative;
        display: flex;
        flex-direction: column-reverse;

        @include nice-scrollbar();

        @include mobile() {
            padding: 10px;
            -webkit-overflow-scrolling: touch;
        }
    }

    .day-group {
        position: relative;

        .date-label {
            padding: $sp2;
            background-color: var(--currentChat-date-bg);
            position: sticky;
            top: 0;
            width: 200px;
            margin: auto;
            border-radius: $sp4;
            @include z-index("date-label");
            @include font(book, normal, fs-70);
            text-align: center;
            margin-bottom: $sp4;
        }
    }
</style>
