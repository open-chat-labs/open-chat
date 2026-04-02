<script lang="ts">
    import {
        Body,
        ColourVars,
        Container,
        type SizeMode,
        type BorderRadiusSize,
        type Radius,
    } from "component-lib";
    import {
        chatIdentifiersEqual,
        chatListScopeStore,
        currentUserIdStore,
        OpenChat,
        routeForChatIdentifier,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type ChatIdentifier,
        type ChatType,
        type Message,
        type RehydratedReplyContext,
        type SenderContext,
        type UserSummary,
    } from "openchat-client";
    import page from "page";
    import { getContext, type Snippet } from "svelte";
    import Typing from "../../Typing.svelte";
    import Badges from "../profile/Badges.svelte";
    import BotBadge from "../profile/BotBadge.svelte";
    import RoleIcon from "../profile/RoleIcon.svelte";
    import WithRole from "../profile/WithRole.svelte";
    import UnresolvedReply from "../UnresolvedReply.svelte";
    import MessageMetadata from "./MessageMetadata.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        senderTyping?: boolean;
        senderContext?: SenderContext;
        sender?: UserSummary;
        ref?: HTMLElement;
        msg: Message;
        messageContent?: Snippet<[boolean]>;
        hasThread?: boolean;
        time: number;
        first?: boolean;
        last?: boolean;
        failed?: boolean;
        undeleting?: boolean;
        bot: boolean;
        accepted?: boolean;
        chatType: ChatType;
        readByThem?: boolean;
        readByMe?: boolean;
        expiresAt: number | undefined;
        percentageExpired?: number;
        pinned: boolean;
        repliesTo: Snippet<[RehydratedReplyContext]>;
        fill: boolean;
        onOpenUserProfile: (e?: Event) => void;
        focused?: boolean;
        onGoToMessageIndex?: (args: { index: number }) => void;
    }

    let {
        chatId,
        senderTyping = false,
        senderContext,
        sender,
        ref = $bindable(),
        msg,
        messageContent,
        time,
        hasThread = false,
        first = false,
        last = false,
        failed = false,
        undeleting = false,
        bot,
        accepted = true,
        chatType,
        readByThem = true,
        readByMe = true,
        expiresAt,
        percentageExpired = 0,
        pinned,
        repliesTo,
        fill,
        onOpenUserProfile,
        focused = false,
        onGoToMessageIndex,
    }: Props = $props();

    let multiUserChat = $derived(chatType === "group_chat" || chatType === "channel");
    let streak = $derived(sender?.streak ?? 0);
    let chitEarned = $derived(sender?.totalChitEarned ?? 0);
    let senderDisplayName = $derived(
        client.getDisplayName(
            msg.sender,
            $selectedCommunityMembersStore,
            $selectedChatWebhooksStore,
        ),
    );
    let isProposal = $derived(msg.content.kind === "proposal_content");
    let isPrize = $derived(msg.content.kind === "prize_content");
    // let hasReactions = $derived(msg.reactions.length > 0);
    let me = $derived(msg.sender === $currentUserIdStore);
    let showHeader = $derived(
        first && !isProposal && !isPrize && !me && chatType !== "direct_chat",
    );
    let backgroundColour = $derived.by(() => {
        if (failed) {
            return ColourVars.error;
        }
        if (msg.deleted) {
            return "transparent";
        }
        if (me) {
            return ColourVars.myChatBubble;
        }

        return ColourVars.background2;
    });
    let borderRadius = $derived.by<Radius>(() => {
        // top, right, bottom, left
        if (me) {
            return ["xl", "sm", hasThread || !last ? "sm" : "xl", "xl"];
        } else {
            return ["sm", "xl", "xl", hasThread || !last ? "sm" : "xl"];
        }
    });

    let senderContainer = $state<HTMLDivElement>();
    let senderWidth = $derived(senderContainer?.offsetWidth ?? 0);
    let contentWidth = $state(0);
    let mediaContent = $derived(
        ["image_content", "video_content", "giphy_content"].indexOf(msg.content.kind) > -1,
    );
    let headerWidth = $derived<SizeMode>(
        mediaContent && contentWidth < senderWidth ? { size: `${contentWidth}px` } : "fill",
    );

    // Show only for deleted messages!
    let borderColour = $derived.by(() => {
        if (!msg.deleted) return "transparent";
        return ColourVars.background2;
    });

    let classList = $derived.by(() => {
        const classes = ["message_bubble"];
        if (focused) {
            classes.push("focused");
        }
        // TODO What is this about? Seems to be attached to "me" and participant's message bubbles.
        if (readByMe) {
            classes.push("read_by_me");
        }
        if (!showHeader) {
            classes.push("no_header");
        }
        return classes.join(" ");
    });

    function getUrl(repliesTo: RehydratedReplyContext) {
        const path = [
            routeForChatIdentifier($chatListScopeStore.kind, repliesTo.sourceContext.chatId),
            repliesTo.sourceContext.threadRootMessageIndex ?? repliesTo.messageIndex,
        ];
        if (repliesTo.sourceContext.threadRootMessageIndex !== undefined) {
            path.push(repliesTo.messageIndex);
        }
        return path.join("/");
    }

    function zoomToMessage(repliesTo: RehydratedReplyContext) {
        if (chatIdentifiersEqual(repliesTo.sourceContext.chatId, chatId)) {
            onGoToMessageIndex?.({
                index: repliesTo.messageIndex,
            });
        } else {
            page(getUrl(repliesTo));
        }
    }
</script>

<Container
    bind:ref
    supplementalClass={classList}
    gap={"xxs"}
    width={"fill"}
    padding={"xs"}
    overflow={"auto"}
    direction={"vertical"}
    background={backgroundColour}
    borderWidth={msg.deleted ? "thick" : "zero"}
    {borderRadius}
    {borderColour}>
    {#if showHeader}
        <Container
            bind:ref={senderContainer}
            width={headerWidth}
            padding={["zero", "sm"]}
            borderRadius={fill
                ? [borderRadius[0] as BorderRadiusSize, "zero", "lg", "zero"]
                : "zero"}
            supplementalClass={`message_sender ${fill ? "fill" : ""}`}
            crossAxisAlignment={"center"}
            gap={"xs"}
            onClick={onOpenUserProfile}>
            <Body fontWeight={"bold"} maxLines={1} colour={"textSecondary"}>
                {senderDisplayName}
            </Body>
            <Badges
                uniquePerson={sender?.isUniquePerson}
                diamondStatus={sender?.diamondStatus}
                {streak}
                {chitEarned} />
            <BotBadge
                bot={senderContext?.kind === "bot"}
                webhook={senderContext?.kind === "webhook"} />
            {#if sender !== undefined && multiUserChat}
                <WithRole
                    userId={sender.userId}
                    chatMembers={$selectedCommunityMembersStore}
                    communityMembers={$selectedCommunityMembersStore}>
                    {#snippet children(communityRole, chatRole)}
                        <RoleIcon level="community" popup role={communityRole} />
                        <RoleIcon
                            level={chatType === "channel" ? "channel" : "group"}
                            popup
                            role={chatRole} />
                    {/snippet}
                </WithRole>
            {/if}
            {#if senderTyping}
                <Body colour={"primary"}>
                    <Typing />
                </Body>
            {/if}
        </Container>
    {/if}
    {#if !msg.deleted && msg.repliesTo !== undefined}
        {@const reply =
            msg.repliesTo.kind === "rehydrated_reply_context" ? msg.repliesTo : undefined}
        <Container
            onClick={reply ? () => zoomToMessage(reply) : undefined}
            supplementalClass={`reply_wrapper ${me ? "me" : ""}`}
            direction={"vertical"}>
            {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                {@render repliesTo(msg.repliesTo)}
            {:else}
                <UnresolvedReply />
            {/if}
        </Container>
    {/if}
    <div class="message_bubble_content" bind:clientWidth={contentWidth}>
        {@render messageContent?.(me)}
    </div>
    {#if !msg.deleted}
        <MessageMetadata
            {failed}
            deleted={msg.deleted}
            {undeleting}
            {bot}
            {me}
            {fill}
            {accepted}
            {chatType}
            {readByThem}
            {expiresAt}
            {percentageExpired}
            {pinned}
            edited={msg.edited}
            {time} />
    {/if}
</Container>

<style lang="scss">
    :global {
        .container.message_sender {
            .typo.body {
                flex: initial !important;
            }

            .fill {
                z-index: 1;
                position: absolute;
                color: var(--text-primary);
                text-shadow: 0 0 0.125rem var(--backdrop);
            }
        }

        .container.message_bubble {
            transition: box-shadow ease-in 300ms;
        }

        .container.message_bubble a {
            color: inherit;
        }

        .container.message_bubble .typo {
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
        }

        .container.message_bubble .markdown-wrapper {
            word-break: break-word;
        }

        .container.message_bubble.focused {
            box-shadow: 0 0 0 0.25rem var(--primary-muted);
        }

        .container.message_bubble:not(.read_by_me) {
            box-shadow: 0 0 0 0.25rem var(--primary-muted);
        }

        // Removes extra space between sender name and content of the message.
        // Only applied in cases where title and text content are siblings.
        .container.message_sender + .container.text_content {
            padding-top: 0 !important;
        }
    }
</style>
