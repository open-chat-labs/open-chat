<script lang="ts">
    import type { MessageActivityEvent } from "@client";
    import {
        activityFeedShowing,
        allUsersStore,
        AvatarSize,
        bridgedUsersStore,
        communitiesStore,
        currentUserIdStore,
        OpenChat,
        routeForMessageContext,
        type MessageContext,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { buildDisplayName } from "../../../utils/user";
    import { activitySummary, isByRelayedAuthor } from "@src/logic/activity/activitySummary";
    import { messageAuthorName } from "@src/logic/chats/latestMessagePreview";
    import Avatar from "../../Avatar.svelte";
    import Link from "../../Link.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import MessageReaction from "../MessageReaction.svelte";
    import TipThumbnail from "../TipThumbnail.svelte";
    import ActivityIcon from "./ActivityIcon.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        event: MessageActivityEvent;
        selected: boolean;
        onClick: () => void;
    }

    let { event, selected, onClick }: Props = $props();

    function getChatName(ctx: MessageContext): string | undefined {
        const chat = client.lookupChatSummary(ctx.chatId);
        const parts = [];
        if (chat !== undefined) {
            switch (chat.kind) {
                case "direct_chat":
                    parts.push(client.getDisplayName(chat.them.userId));
                    break;
                case "group_chat":
                    parts.push(chat.name);
                    break;
                case "channel": {
                    const community = $communitiesStore.get({
                        kind: "community",
                        communityId: chat.id.communityId,
                    });
                    if (community) {
                        parts.push(community.name);
                    }
                    parts.push(chat.name);
                    break;
                }
            }
            if (ctx.threadRootMessageIndex !== undefined) {
                parts.push("Thread");
            }
            return parts.join(" > ");
        }
        return undefined;
    }

    function formatLatestMessage(event: MessageActivityEvent, username: string): string {
        if (event.message === undefined) return "TODO - not sure what this means";
        const latestMessageText = client.getContentAsText($_, event.message.content);
        return `${username}: ${latestMessageText}`;
    }

    function goToEventContext() {
        activityFeedShowing.set(false);
        navigate(routeForMessageContext("none", event.messageContext, true));
    }
    let sender = $derived(event.userId ? $allUsersStore.get(event.userId) : undefined);
    // Bold, like the feed's other names
    let messageUsername = $derived(
        event.message
            ? `**${messageAuthorName(event.message, {
                  formatter: $_,
                  me: $currentUserIdStore,
                  displayName: (userId, kind) =>
                      buildDisplayName($allUsersStore, userId, kind, false),
                  bridgedUsers: $bridgedUsersStore,
                  users: $allUsersStore,
              })}**`
            : $_("activity.anon"),
    );
    let eventUsername = $derived(
        isByRelayedAuthor(event, event.message)
            ? messageUsername
            : event.userId
              ? buildDisplayName(
                    $allUsersStore,
                    event.userId,
                    event.userId === $currentUserIdStore ? "me" : "user",
                )
              : $_("activity.anon"),
    );
    let lastMessage = $derived(formatLatestMessage(event, messageUsername));
    let eventSummary = $derived(
        activitySummary(event, event.message, {
            me: $currentUserIdStore,
            username: eventUsername,
            displayName: (u) =>
                buildDisplayName($allUsersStore, u, u === $currentUserIdStore ? "me" : "user"),
        }),
    );
    let chatName = $derived(getChatName(event.messageContext));
    let tips = $derived(event?.message?.tips ? Object.entries(event.message.tips) : []);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div role="button" class="activity-event" class:selected tabindex="0" onclick={onClick}>
    <div class="header">
        <div class="name">
            <Link onClick={goToEventContext}>{chatName}</Link>
        </div>
        <div class="date">
            {client.formatMessageDate(event.timestamp, $_("today"), $_("yesterday"), true, true)}
        </div>
    </div>
    <div class="body">
        <div class="avatar">
            <Avatar
                statusBorder={selected ? "var(--chatSummary-hv)" : "transparent"}
                url={client.userAvatarUrl(sender)}
                userId={event.userId}
                size={AvatarSize.Default} />
            <ActivityIcon activity={event.activity} />
        </div>
        <div class="details">
            <div class="event-sumary">
                <h4>
                    <Markdown text={interpolate($_, eventSummary)} />
                </h4>
            </div>
            <div class="chat-msg">
                {#if event.message !== undefined}
                    <Markdown text={lastMessage} oneLine twoLine suppressLinks />
                {:else}
                    <Translatable resourceKey={i18nKey("activity.missingMessage")} />
                {/if}
            </div>
            {#if event.activity === "reaction" && event.message !== undefined && event.message.reactions.length > 0}
                <div class="message-reactions">
                    {#each event.message.reactions as { reaction, userIds } (reaction)}
                        <MessageReaction {reaction} {userIds} />
                    {/each}
                </div>
            {/if}
            {#if event.activity === "tip" && tips.length > 0}
                <div class="tips">
                    {#each tips as [ledger, userTips]}
                        <TipThumbnail canTip={false} {ledger} {userTips} />
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    :global(.activity-event a) {
        color: inherit;
    }

    .activity-event {
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
        cursor: pointer;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        user-select: none;
        border-bottom: var(--bw) solid var(--bd);

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--txt-light);
        @include font(book, normal, fs-60);
        padding: $sp3 $sp4 0 $sp4;
    }

    .body {
        padding: $sp3 $sp4 $sp4 $sp4;
        display: flex;
        align-items: flex-start;
        gap: 12px;

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }

    .avatar {
        flex: 0 0 40px;
        position: relative;
    }

    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        overflow: hidden;

        .event-sumary {
            h4 {
                @include font(medium, normal, fs-100);
                display: flex;
                flex-direction: row;
                gap: $sp2;
            }
            margin-bottom: $sp1;
        }

        .chat-msg {
            color: var(--txt-light);
            @include font(book, normal, fs-80);
        }
    }

    .date {
        display: flex;
        gap: $sp2;
        align-self: flex-end;
        color: var(--txt-light);
        @include font(book, normal, fs-60);
    }

    .message-reactions,
    .tips {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: $sp2;
    }
</style>
