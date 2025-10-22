<script lang="ts">
    import {
        Body,
        ColourVars,
        Container,
        type BorderRadiusSize,
        type Padding,
        type Radius,
        type SwipeDirection,
    } from "component-lib";
    import {
        currentUserIdStore,
        OpenChat,
        publish,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        type ChatType,
        type Message,
        type RehydratedReplyContext,
        type SenderContext,
        type UserSummary,
    } from "openchat-client";
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
        senderTyping: boolean;
        senderContext?: SenderContext;
        sender?: UserSummary;
        ref?: HTMLElement;
        msg: Message;
        messageContent?: Snippet<[boolean]>;
        hasThread?: boolean;
        time: number;
        first: boolean;
        last: boolean;
        failed: boolean;
        undeleting: boolean;
        bot: boolean;
        accepted: boolean;
        chatType: ChatType;
        readByThem: boolean;
        expiresAt: number | undefined;
        percentageExpired: number;
        pinned: boolean;
        repliesTo: Snippet<[RehydratedReplyContext]>;
        fill: boolean;
        onOpenUserProfile: (e?: Event) => void;
    }

    let {
        senderTyping,
        senderContext,
        sender,
        ref = $bindable(),
        msg,
        messageContent,
        time,
        hasThread = false,
        first,
        last,
        failed,
        undeleting,
        bot,
        accepted,
        chatType,
        readByThem,
        expiresAt,
        percentageExpired,
        pinned,
        repliesTo,
        fill,
        onOpenUserProfile,
    }: Props = $props();

    let senderContainer = $state<HTMLDivElement>();
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
    let hasReactions = $derived(msg.reactions.length > 0);
    let showHeader = $derived(first && !isProposal && !isPrize);
    let hasReply = $derived(msg.repliesTo !== undefined);
    let me = $derived(msg.sender === $currentUserIdStore);
    let backgroundColour = $derived(me ? ColourVars.primary : ColourVars.background2);
    let padding = $derived.by<Padding>(() => {
        if (fill) return "zero";
        const uniform = hasReactions && !hasThread;
        if (hasReply) {
            return ["xs", "xs", uniform ? "xs" : "xxs", "xs"];
        }
        return ["xs", "sm", uniform ? "sm" : "xxs", "sm"];
    });
    let contentPadding = $derived<Padding>(hasReply ? "xs" : "zero");
    let borderRadius = $derived.by<Radius>(() => {
        // top, right, bottom, left
        if (me) {
            return ["xl", "sm", hasThread || !last ? "sm" : "xl", "xl"];
        } else {
            return ["sm", "xl", "xl", hasThread || !last ? "sm" : "xl"];
        }
    });
    let senderWidth = $derived.by(() => {
        if (senderContainer) {
            return `${senderContainer.offsetWidth}px`;
        } else {
            return "auto";
        }
    });

    // this is terrible
    function adjustInnerRadius(outer: BorderRadiusSize): BorderRadiusSize {
        if (outer === "xl") return "lg";
        return outer;
    }

    let replyRadius = $derived<Radius>([
        first ? "sm" : adjustInnerRadius(borderRadius[0] as BorderRadiusSize),
        first ? "sm" : adjustInnerRadius(borderRadius[1] as BorderRadiusSize),
        "sm",
        "sm",
    ]);

    function onSwipe(dir: SwipeDirection) {
        // This *should* be done at a much higher level (and it is)
        // But unfortunately because there is also a long press menu
        // trigger on the message bubble it will stop the touch event
        // bubbling far enough. This is a work around until I can think
        // of a better solution.
        //
        // The root cause is that both longpress and swipe deal in touchstart
        // events and we don't want to allow those to bubble otherwise they
        // interfere with each other. But sometimes we *do* need them to bubble.
        //
        // Might be that we need custom events for Swipe and Longpress so that
        // they can bubble without interference.
        if (dir === "right") {
            publish("clearSelection");
        }
    }
</script>

<Container
    {onSwipe}
    bind:ref
    allowOverflow
    minWidth={senderWidth}
    direction={"vertical"}
    {borderRadius}
    {padding}
    gap={"xs"}
    width={{ kind: "fill" }}
    background={backgroundColour}>
    {#if showHeader}
        <Container
            width={{ kind: "hug" }}
            bind:ref={senderContainer}
            padding={fill ? "xs" : "zero"}
            borderRadius={fill
                ? [borderRadius[0] as BorderRadiusSize, "zero", "lg", "zero"]
                : "zero"}
            background={fill ? "rgba(0,0,0,0.3)" : undefined}
            supplementalClass={`message_sender ${fill ? "fill" : ""}`}
            crossAxisAlignment={"center"}
            gap={"xs"}
            onClick={onOpenUserProfile}>
            <Body fontWeight={"bold"} width={{ kind: "hug" }}>{senderDisplayName}</Body>
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
    {#if msg.repliesTo !== undefined}
        <Container
            borderRadius={replyRadius}
            padding={"md"}
            supplementalClass={`reply-wrapper ${me ? "me" : ""}`}
            direction={"vertical"}
            background={me ? ColourVars.primaryMuted : ColourVars.background0}>
            {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                {@render repliesTo(msg.repliesTo)}
            {:else}
                <UnresolvedReply />
            {/if}
        </Container>
    {/if}
    <!-- this is a bit of an annoying wrapper -->
    <Container
        borderRadius={fill ? borderRadius : undefined}
        direction={"vertical"}
        gap={"xs"}
        padding={contentPadding}>
        {@render messageContent?.(me)}
    </Container>
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
        {time}></MessageMetadata>
</Container>

<style lang="scss">
    :global(.reply-wrapper.me a) {
        color: inherit;
    }

    :global(.container.message_sender.fill) {
        position: absolute;
        color: #fff;
        z-index: 1;
        width: max-content !important;
    }
</style>
