<script lang="ts">
    import type { Message, MessageActivityEvent, ResourceKey } from "openchat-client";
    import {
        activityFeedShowing,
        allUsersStore,
        AvatarSize,
        communitiesStore,
        currentUserIdStore,
        OpenChat,
        routeForMessageContext,
        type MessageContext,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { buildDisplayName } from "../../../utils/user";
    import Avatar from "../../Avatar.svelte";
    import Link from "../../Link.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
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
                    parts.push(client.getDisplayNameById(chat.them.userId));
                    break;
                case "group_chat":
                    parts.push(chat.name);
                    break;
                case "channel":
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
            if (ctx.threadRootMessageIndex !== undefined) {
                parts.push("Thread");
            }
            return parts.join(" > ");
        }
        return undefined;
    }

    function otherReactors(ev: MessageActivityEvent): Set<string> {
        if (ev.message === undefined) return new Set();
        return new Set(
            ev.message.reactions.flatMap((r) =>
                [...r.userIds].filter((u) => u !== ev.userId && u !== $currentUserIdStore),
            ),
        );
    }

    function otherTippers(ev: MessageActivityEvent): Set<string> {
        if (ev.message === undefined) return new Set();
        return new Set(
            Object.values(ev.message.tips).flatMap((tips) => {
                return Object.keys(tips).filter((u) => u !== ev.userId);
            }),
        );
    }

    function numberOfPeopleVoting(msg: Message | undefined): number {
        if (msg === undefined || msg.content.kind !== "poll_content") return 1;
        const content = msg.content;
        if (content.votes.total.kind === "anonymous_poll_votes") {
            return Object.values(content.votes.total.votes).reduce((total, n) => total + n, 0);
        } else if (content.votes.total.kind === "hidden_poll_votes") {
            return content.votes.total.votes;
        } else if (content.votes.total.kind === "visible_poll_votes") {
            return Object.values(content.votes.total.votes).reduce(
                (total, n) => total + n.length,
                0,
            );
        }
        return 1;
    }

    function pluraliseMessage(
        root: "tip" | "reaction",
        username: string,
        others: Set<string>,
    ): ResourceKey {
        switch (others.size) {
            case 0:
                return i18nKey(`activity.${root}One`, { username });
            case 1:
                const u = [...others][0];
                return i18nKey(`activity.${root}Two`, {
                    username,
                    other: buildDisplayName(
                        $allUsersStore,
                        u,
                        u === $currentUserIdStore ? "me" : "user",
                    ),
                });
            default:
                return i18nKey(`activity.${root}N`, { username, n: others.size });
        }
    }

    function buildEventSummary(event: MessageActivityEvent, username: string) {
        switch (event.activity) {
            case "reaction":
                return pluraliseMessage("reaction", username, otherReactors(event));
            case "mention":
                return i18nKey("activity.mention", { username });
            case "quote_reply":
                return i18nKey("activity.quoteReply", { username });
            case "tip":
                return pluraliseMessage("tip", username, otherTippers(event));
            case "crypto":
                return i18nKey("activity.crypto", { username });
            case "poll_vote":
                const numVoters = numberOfPeopleVoting(event.message);
                if (numVoters > 1) {
                    return i18nKey("activity.pollVoteN", { username, number: numVoters - 1 });
                } else {
                    return i18nKey("activity.pollVote", { username });
                }
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
    let sender = $derived(event.userId ? $allUsersStore.get(event.userId) : undefined);
    let eventUsername = $derived(
        event.userId
            ? buildDisplayName(
                  $allUsersStore,
                  event.userId,
                  event.userId === $currentUserIdStore ? "me" : "user",
              )
            : $_("activity.anon"),
    );
    let messageUsername = $derived(
        event.message
            ? buildDisplayName(
                  $allUsersStore,
                  event.message.sender,
                  event.message.sender === $currentUserIdStore ? "me" : "user",
              )
            : $_("activity.anon"),
    );
    let lastMessage = $derived(formatLatestMessage(event, messageUsername));
    let eventSummary = $derived(buildEventSummary(event, eventUsername));
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
