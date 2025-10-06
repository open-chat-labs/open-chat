<script lang="ts">
    import { Avatar, Body, BodySmall, Caption, Container, CountBadge } from "component-lib";
    import type { Message, MessageActivityEvent, ResourceKey } from "openchat-client";
    import {
        allUsersStore,
        communitiesStore,
        currentUserIdStore,
        OpenChat,
        type MessageContext,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { buildDisplayName } from "../../../utils/user";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import MessageReaction from "../MessageReaction.svelte";
    import TipThumbnail from "../TipThumbnail.svelte";

    const MAX_REACTIONS = 4;
    const client = getContext<OpenChat>("client");

    interface Props {
        event: MessageActivityEvent;
        onClick: () => void;
    }

    let { event, onClick }: Props = $props();

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
        return `${username} / ${latestMessageText}`;
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

<Container padding={"md"} gap={"sm"} supplementalClass={"activity-event"} {onClick}>
    <Avatar size={"sm"} url={client.userAvatarUrl(sender)}></Avatar>
    <Container direction={"vertical"}>
        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <Body fontWeight={"bold"}>
                <Markdown text={interpolate($_, eventSummary)} />
            </Body>
            <Caption colour={"textSecondary"} width={{ kind: "hug" }}>
                {client.formatMessageDate(
                    event.timestamp,
                    $_("today"),
                    $_("yesterday"),
                    true,
                    true,
                )}
            </Caption>
        </Container>
        <BodySmall colour={"textSecondary"}>
            {#if event.message !== undefined}
                <Markdown text={lastMessage} oneLine twoLine suppressLinks />
            {:else}
                <Translatable resourceKey={i18nKey("activity.missingMessage")} />
            {/if}
        </BodySmall>
        <Container gap={"sm"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
            <Caption width={{ kind: "hug" }} colour={"textSecondary"}>{chatName}</Caption>
            {#if event.activity === "reaction" && event.message !== undefined && event.message.reactions.length > 0}
                <Container gap={"xs"} crossAxisAlignment={"center"} width={{ kind: "hug" }}>
                    {@const more = event.message.reactions.length - MAX_REACTIONS}
                    {#each event.message.reactions.slice(0, MAX_REACTIONS) as { reaction, userIds } (reaction)}
                        <MessageReaction {reaction} {userIds} />
                    {/each}
                    {#if more > 0}
                        <CountBadge mode="additive">+{more}</CountBadge>
                    {/if}
                </Container>
            {/if}
            {#if event.activity === "tip" && tips.length > 0}
                <Container gap={"xs"} crossAxisAlignment={"center"} width={{ kind: "hug" }}>
                    {@const more = tips.length - MAX_REACTIONS}
                    {#each tips.slice(0, MAX_REACTIONS) as [ledger, userTips]}
                        <TipThumbnail canTip={false} {ledger} {userTips} />
                    {/each}
                    {#if more > 0}
                        <CountBadge mode="additive">+{more}</CountBadge>
                    {/if}
                </Container>
            {/if}
        </Container>
    </Container>
</Container>

<style lang="scss">
    :global(.activity-event a) {
        color: inherit;
    }

    :global(.activity-event .tip-wrapper) {
        margin-bottom: 0;
        padding: 0;
    }

    :global(.activity-event .message-reaction) {
        margin-bottom: 0;
        padding: 0;
    }
</style>
