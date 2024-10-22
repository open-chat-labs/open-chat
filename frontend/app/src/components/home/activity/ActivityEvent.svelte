<script lang="ts">
    import {
        AvatarSize,
        OpenChat,
        routeForMessageContext,
        type MessageContext,
    } from "openchat-client";
    import type { Message, MessageActivityEvent } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { buildDisplayName } from "../../../utils/user";
    import MessageReaction from "../MessageReaction.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import TipThumbnail from "../TipThumbnail.svelte";
    import Link from "../../Link.svelte";
    import { activityFeedShowing } from "../../../stores/activity";
    import page from "page";

    const client = getContext<OpenChat>("client");

    export let event: MessageActivityEvent;
    export let selected: boolean;

    $: user = client.user;
    $: userId = $user.userId;
    $: userStore = client.userStore;
    $: sender = event.userId ? $userStore.get(event.userId) : undefined;
    $: eventUsername = event.userId
        ? buildDisplayName($userStore, event.userId, event.userId === userId)
        : $_("activity.anon");
    $: messageUsername = event.message
        ? buildDisplayName($userStore, event.message.sender, event.message.sender === userId)
        : $_("activity.anon");
    $: lastMessage = formatLatestMessage(event, messageUsername);
    $: eventSummary = buildEventSummary(event, eventUsername);
    $: chatName = getChatName(event.messageContext);
    $: tips = event?.message?.tips ? Object.entries(event.message.tips) : [];
    $: communities = client.communities;

    function getChatName(ctx: MessageContext): string | undefined {
        const chat = client.lookupChatSummary(ctx.chatId);
        const parts = [];
        if (chat !== undefined) {
            switch (chat.kind) {
                case "direct_chat":
                    parts.push(client.getDisplayNameById(chat.them.userId));
                    break;
                case "group_chat":
                    parts.push(chat.name);
                    break;
                case "channel":
                    const community = $communities.get({
                        kind: "community",
                        communityId: chat.id.communityId,
                    });
                    if (community) {
                        parts.push(community.name);
                    }
                    parts.push(chat.name);
                    break;
            }
            if (ctx.threadRootMessageIndex !== undefined) {
                parts.push("Thread");
            }
            return parts.join(" > ");
        }
        return undefined;
    }

    function numberOfPeopleReacting(msg: Message | undefined): number {
        if (msg === undefined) return 1;
        const all = new Set(msg.reactions.flatMap((r) => [...r.userIds]));
        return all.size;
    }

    function buildEventSummary(event: MessageActivityEvent, username: string) {
        switch (event.activity) {
            case "reaction":
                const num = numberOfPeopleReacting(event.message);
                if (num > 1) {
                    return i18nKey("activity.reactionPlus", { username, number: num - 1 });
                } else {
                    return i18nKey("activity.reaction", { username });
                }
            case "mention":
                return i18nKey("activity.mention", { username });
            case "quote_reply":
                return i18nKey("activity.quoteReply", { username });
            case "thread_reply":
                return i18nKey("activity.threadReply", { username });
            case "tip":
                return i18nKey("activity.tip", { username });
            case "crypto":
                return i18nKey("activity.crypto", { username });
            case "poll_vote":
                return i18nKey("activity.pollVote", { username });
            case "p2p_swap_accepted":
                return i18nKey("activity.p2pSwapAccepted", { username });
        }
    }

    function formatLatestMessage(event: MessageActivityEvent, username: string): string {
        if (event.message === undefined) return "TODO - not sure what this means";
        const latestMessageText = client.getContentAsText($_, event.message.content);
        return `${username}: ${latestMessageText}`;
    }

    function goToEventContext() {
        activityFeedShowing.set(false);
        page(routeForMessageContext("none", event.messageContext, true));
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div role="button" class="activity-event" class:selected tabindex="0" on:click>
    <div class="header">
        <div class="name">
            <Link on:click={goToEventContext}>{chatName}</Link>
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
        </div>
        <div class="details">
            <div class="name-date">
                <div class="event-sumary">
                    <h4>
                        <Markdown text={interpolate($_, eventSummary)} />
                    </h4>
                </div>
            </div>
            <div class="chat-msg">
                <Markdown text={lastMessage} oneLine twoLine suppressLinks />
            </div>
            {#if event.activity === "reaction" && event.message !== undefined && event.message.reactions.length > 0}
                <div class="message-reactions">
                    {#each event.message.reactions as { reaction, userIds } (reaction)}
                        <MessageReaction {reaction} {userIds} myUserId={userId} />
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
        padding: $sp4;
        display: flex;
        align-items: flex-start;

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
        padding: 0 0 0 12px;

        .name-date {
            display: flex;
            margin-bottom: $sp1;

            .event-sumary {
                h4 {
                    @include font(medium, normal, fs-100);
                    display: flex;
                    flex-direction: row;
                    gap: $sp2;
                }

                display: flex;
                align-items: center;
                gap: $sp2;
                flex: auto;
            }
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
