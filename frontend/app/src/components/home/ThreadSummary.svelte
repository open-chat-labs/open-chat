<script lang="ts">
    import type { OpenChat, ThreadSummary } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Avatar from "../Avatar.svelte";
    import { getContext, onMount } from "svelte";

    const client = getContext<OpenChat>("client");

    export let threadSummary: ThreadSummary;
    export let indent: boolean;
    export let me: boolean;
    export let selected: boolean;
    export let url: string;
    export let chatId: string;
    export let threadRootMessageIndex: number;

    $: messagesRead = client.messagesRead;
    $: userStore = client.userStore;
    $: threadsFollowedByMeStore = client.threadsFollowedByMeStore;
    $: isFollowedByMe = $threadsFollowedByMeStore[chatId]?.has(threadRootMessageIndex) ?? false;
    $: lastMessageIndex = threadSummary.numberOfReplies - 1; //using this as a surrogate for message index for now
    $: unreadCount = client.unreadThreadMessageCount(
        chatId,
        threadRootMessageIndex,
        lastMessageIndex
    );

    onMount(() => {
        return messagesRead.subscribe(() => {
            unreadCount = client.unreadThreadMessageCount(
                chatId,
                threadRootMessageIndex,
                lastMessageIndex
            );
        });
    });
</script>

<div class="thread-summary-wrapper" class:me class:indent>
    <a href={url} class="thread-summary" class:selected>
        <div class="thread-avatars">
            {#each [...threadSummary.participantIds].slice(0, 5) as participantId}
                <Avatar
                    url={client.userAvatarUrl($userStore[participantId])}
                    userId={participantId}
                    size={AvatarSize.Tiny} />
            {/each}
            {#if threadSummary.participantIds.size > 5}
                <div class="thread-extra">
                    {`+${threadSummary.participantIds.size - 5}`}
                </div>
            {/if}
        </div>
        <div class="thread-legend">
            <span
                >{$_("thread.nreplies", {
                    values: {
                        number: threadSummary.numberOfReplies.toString(),
                        replies:
                            threadSummary.numberOfReplies === 1
                                ? $_("thread.reply")
                                : $_("thread.replies"),
                        message: $mobileWidth
                            ? ""
                            : $_("thread.lastMessage", {
                                  values: {
                                      date: client.formatMessageDate(
                                          threadSummary.latestEventTimestamp,
                                          $_("today"),
                                          $_("yesterday"),
                                          true,
                                          true
                                      ),
                                  },
                              }),
                    },
                })}
                <div class:selected class="arrow">&#8595;</div></span>
        </div>
    </a>
    {#if isFollowedByMe && unreadCount > 0}
        <div
            in:pop={{ duration: 1500 }}
            title={$_("chatSummary.unread", { values: { count: unreadCount.toString() } })}
            class="unread-count">
            {unreadCount > 999 ? "999+" : unreadCount}
        </div>
    {/if}
</div>

<style type="text/scss">
    $avatar-width: 53px;
    $avatar-width-mob: 43px;

    .unread-count {
        @include unread();
    }

    .thread-summary-wrapper {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp2;

        &.indent {
            margin-left: $avatar-width;
            @include mobile() {
                margin-left: $avatar-width-mob;
            }
        }
    }

    .arrow {
        transition: transform 200ms ease-in-out;
        display: inline-block;
        transform-origin: 50% 50%;

        &.selected {
            transform: rotate(-90deg);
        }
    }

    .thread-summary {
        display: inline-flex;
        align-items: center;
        gap: $sp2;
        padding: $sp2 $sp3;
        border-radius: $sp3;
        cursor: pointer;
        transition: background 200ms ease-in-out;
        border: 1px solid var(--bd);
        color: var(--currentChat-msg-txt);

        &:not(.selected):hover {
            background: rgba(255, 255, 255, 0.1);
        }

        &.selected {
            background: var(--notificationBar-bg);
            color: var(--notificationBar-txt);
        }

        .thread-avatars {
            display: flex;
            gap: $sp2;
        }

        .thread-legend {
            @include font(book, normal, fs-80);
            margin-left: $sp2;
        }

        .thread-extra {
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50%;
            width: toRem(25);
            height: toRem(25);
            @include font-size(fs-60);
            background-color: rgba(0, 0, 0, 0.15);
        }
    }
</style>
