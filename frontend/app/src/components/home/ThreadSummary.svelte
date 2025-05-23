<script lang="ts">
    import type { ChatIdentifier, OpenChat, ThreadSummary } from "openchat-client";
    import {
        allUsersStore,
        AvatarSize,
        messagesRead,
        mobileWidth,
        threadsFollowedByMeStore,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import Avatar from "../Avatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        threadSummary: ThreadSummary;
        indent: boolean;
        me: boolean;
        selected: boolean;
        url: string;
        chatId: ChatIdentifier;
        threadRootMessageIndex: number;
    }

    let { threadSummary, indent, me, selected, url, chatId, threadRootMessageIndex }: Props =
        $props();

    let isFollowedByMe = $derived(
        $threadsFollowedByMeStore.get(chatId)?.has(threadRootMessageIndex) ?? false,
    );
    let lastMessageIndex = $derived(threadSummary.numberOfReplies - 1); //using this as a surrogate for message index for now
    let unreadCount = $derived(
        client.unreadThreadMessageCount(chatId, threadRootMessageIndex, lastMessageIndex),
    );

    onMount(() => {
        return messagesRead.subscribe(() => {
            unreadCount = client.unreadThreadMessageCount(
                chatId,
                threadRootMessageIndex,
                lastMessageIndex,
            );
        });
    });
</script>

<div class="thread-summary-wrapper" class:me class:indent>
    <a href={url} class="thread-summary" class:selected>
        <div class="thread-avatars">
            {#each [...threadSummary.participantIds].slice(0, 5) as participantId}
                <Avatar
                    url={client.userAvatarUrl($allUsersStore.get(participantId))}
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
                                          true,
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

<style lang="scss">
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

        @media (hover: hover) {
            &:not(.selected):hover {
                background: rgba(255, 255, 255, 0.1);
            }
        }

        &.selected {
            background: var(--notificationBar-bg);
            color: var(--notificationBar-txt);
            border: 1px solid transparent;
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
