<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import MembersChangedEvent from "./MembersChangedEvent.svelte";
    import PermissionsChangedEvent from "./PermissionsChangedEvent.svelte";
    import RoleChangedEvent from "./RoleChangedEvent.svelte";
    import AggregateMembersJoinedEvent from "./AggregateMembersJoinedEvent.svelte";
    import type {
        CreatedUser,
        UserSummary,
        ChatEvent,
        EventWrapper,
        Message,
        OpenChat,
    } from "openchat-client";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import GroupRulesChangedEvent from "./GroupRulesChangedEvent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import GroupVisibilityChangedEvent from "./GroupVisibilityChangedEvent.svelte";
    import GroupInviteCodeChangedEvent from "./GroupInviteCodeChangedEvent.svelte";
    import ChatFrozenEvent from "./ChatFrozenEvent.svelte";
    import ChatUnfrozenEvent from "./ChatUnfrozenEvent.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: CreatedUser;
    export let event: EventWrapper<ChatEvent>;
    export let first: boolean;
    export let last: boolean;
    export let me: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let preview: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let canReplyInThread: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let inThread: boolean;
    export let supportsEdit: boolean;
    export let supportsReply: boolean;
    export let collapsed: boolean;

    let userSummary: UserSummary | undefined = undefined;

    $: typing = client.typing;
    $: {
        userSummary = {
            kind: "user",
            userId: user.userId,
            username: user.username,
            lastOnline: Date.now(),
            updated: BigInt(0),
        };
    }

    function editEvent() {
        dispatch("editEvent", event as EventWrapper<Message>);
    }
</script>

{#if event.event.kind === "message"}
    <ChatMessage
        senderId={event.event.sender}
        senderTyping={client.isTyping($typing, event.event.sender, chatId)}
        {focused}
        {observer}
        {confirmed}
        {readByMe}
        {readByThem}
        {chatId}
        {chatType}
        {user}
        {me}
        {first}
        {last}
        {preview}
        {pinned}
        {canPin}
        {canBlockUser}
        {canDelete}
        canQuoteReply={canSend}
        {canReact}
        canStartThread={canReplyInThread}
        {publicGroup}
        {editing}
        {inThread}
        {supportsEdit}
        {supportsReply}
        {collapsed}
        on:chatWith
        on:goToMessageIndex
        on:replyPrivatelyTo
        on:replyTo
        on:selectReaction
        on:deleteMessage
        on:blockUser
        on:pinMessage
        on:unpinMessage
        on:registerVote
        on:editMessage={editEvent}
        on:upgrade
        on:forward
        on:copyMessageUrl
        on:shareMessage
        on:expandMessage
        on:collapseMessage
        eventIndex={event.index}
        timestamp={event.timestamp}
        msg={event.event} />
{:else if event.event.kind === "group_chat_created"}
    <GroupChatCreatedEvent event={event.event} {me} timestamp={event.timestamp} />
{:else if event.event.kind === "direct_chat_created"}
    <DirectChatCreatedEvent timestamp={event.timestamp} />
{:else if event.event.kind === "members_added"}
    <MembersChangedEvent
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.addedBy}
        resourceKey={"addedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "members_removed"}
    <MembersChangedEvent
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.removedBy}
        resourceKey={"removedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "aggregate_members_joined_left"}
    <AggregateMembersJoinedEvent user={userSummary} joined={event.event.users_joined} />
{:else if event.event.kind === "role_changed"}
    <RoleChangedEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "users_blocked"}
    <MembersChangedEvent
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.blockedBy}
        resourceKey={"blockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "users_unblocked"}
    <MembersChangedEvent
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.unblockedBy}
        resourceKey={"unblockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "ownership_transferred"}
    <MembersChangedEvent
        user={userSummary}
        changed={[event.event.newOwner]}
        changedBy={event.event.oldOwner}
        resourceKey={"ownershipTransferredBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "name_changed"}
    <GroupChangedEvent
        user={userSummary}
        changedBy={event.event.changedBy}
        property={$_("groupName")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "desc_changed"}
    <GroupChangedEvent
        user={userSummary}
        changedBy={event.event.changedBy}
        property={$_("groupDesc")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "rules_changed"}
    <GroupRulesChangedEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "avatar_changed"}
    <GroupChangedEvent
        user={userSummary}
        changedBy={event.event.changedBy}
        property={$_("groupAvatar")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_visibility_changed"}
    <GroupVisibilityChangedEvent
        user={userSummary}
        nowPublic={event.event.nowPublic}
        changedBy={event.event.changedBy}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_invite_code_changed"}
    {#if canInvite}
        <GroupInviteCodeChangedEvent
            user={userSummary}
            change={event.event.change}
            changedBy={event.event.changedBy}
            timestamp={event.timestamp} />
    {/if}
{:else if event.event.kind === "permissions_changed"}
    <PermissionsChangedEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "chat_frozen"}
    <ChatFrozenEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "chat_unfrozen"}
    <ChatUnfrozenEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind !== "reaction_added" && event.event.kind !== "reaction_removed" && event.event.kind !== "message_pinned" && event.event.kind !== "message_unpinned" && event.event.kind !== "poll_ended" && event.event.kind !== "member_joined" && event.event.kind !== "member_left"}
    <div>Unexpected event type</div>
{/if}
