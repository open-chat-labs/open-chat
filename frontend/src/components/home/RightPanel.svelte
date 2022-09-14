<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddMembers from "./groupdetails/AddMembers.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import type { RightPanelState } from "../../fsm/rightPanel";
    import type {
        ChatEvent,
        ChatMetrics,
        EventWrapper,
        FullMember,
        GroupChatSummary,
        Message,
    } from "../../domain/chat/chat";
    import {
        addMembers,
        blockUser,
        ChatController,
        dismissAsAdmin,
        makeAdmin,
        removeMember,
        transferOwnership,
    } from "../../fsm/chat.controller";
    import { userStore } from "../../stores/user";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import { nullUser } from "../../domain/user/user.utils";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import { currentUserKey } from "../../stores/user";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import type { Readable } from "svelte/store";
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    import { replace, querystring } from "svelte-spa-router";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { eventsStore, selectedChatId, selectedChatStore } from "../../stores/chat";
    import {
        currentChatMembers,
        currentChatBlockedUsers,
        currentChatPinnedMessages,
    } from "../../stores/chat";

    const dispatch = createEventDispatcher();

    export let rightPanelHistory: RightPanelState[];
    export let userId: string;
    export let metrics: ChatMetrics;
    export let thread: Thread | undefined;

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    let savingMembers = false;

    $: user = $userStore[userId] ?? nullUser("unknown");
    $: lastState = rightPanelHistory[rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = $numberOfColumns === 2;
    $: groupChat = selectedChatStore as Readable<GroupChatSummary>;

    function onDismissAsAdmin(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            dismissAsAdmin(api, $selectedChatId, ev.detail);
        }
    }

    function onMakeAdmin(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            makeAdmin(api, $selectedChatId, ev.detail);
        }
    }

    function onRemoveMember(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            currentChatMembers.update($selectedChatId, (ps) =>
                ps.filter((p) => p.userId !== ev.detail)
            );
            removeMember(api, $selectedChatId, ev.detail);
        }
    }

    function popHistory() {
        rightPanelHistory = rightPanelHistory.slice(0, rightPanelHistory.length - 1);
    }

    function onBlockUser(ev: CustomEvent<{ userId: string }>) {
        if ($selectedChatId !== undefined) {
            blockUser(api, $selectedChatId, ev.detail.userId);
        }
    }

    async function onTransferOwnership(ev: CustomEvent<FullMember>) {
        if ($selectedChatId !== undefined) {
            const success = await transferOwnership(api, $selectedChatId, userId, ev.detail);
            if (success) {
                toastStore.showSuccessToast("transferOwnershipSucceeded");
            } else {
                toastStore.showFailureToast("transferOwnershipFailed");
            }
        }
    }

    async function unblockUser(ev: CustomEvent<UserSummary>) {
        if ($selectedChatId !== undefined) {
            const success = await addMembers(api, $selectedChatId, currentUser.username, true, [
                ev.detail,
            ]);
            if (success) {
                toastStore.showSuccessToast("unblockUserSucceeded");
            } else {
                toastStore.showFailureToast("unblockUserFailed");
            }
        }
    }

    async function saveMembers(ev: CustomEvent<UserSummary[]>) {
        if ($selectedChatId !== undefined) {
            savingMembers = true;
            const success = await addMembers(
                api,
                $selectedChatId,
                currentUser.username,
                false,
                ev.detail
            );
            if (success) {
                popHistory();
            } else {
                toastStore.showFailureToast("addMembersFailed");
            }
            savingMembers = false;
        }
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        if (modal) {
            popHistory();
        }
    }

    function closeThread(ev: CustomEvent<string>) {
        popHistory();
        replace(removeQueryStringParam(new URLSearchParams($querystring), "open"));
    }

    function findMessage(
        events: EventWrapper<ChatEvent>[],
        messageId: bigint
    ): EventWrapper<Message> | undefined {
        return events.find((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId;
        }) as EventWrapper<Message> | undefined;
    }

    $: threadRootEvent =
        lastState.kind === "message_thread_panel" && $selectedChatId !== undefined
            ? findMessage($eventsStore, lastState.rootEvent.event.messageId)
            : undefined;
</script>

<Panel right>
    {#if lastState.kind === "group_details" && $selectedChatId !== undefined}
        <GroupDetails
            chat={$groupChat}
            memberCount={$currentChatMembers.length}
            on:close={popHistory}
            on:deleteGroup
            on:makeGroupPrivate
            on:chatWith
            on:showMembers
            on:updateChat />
    {:else if lastState.kind === "add_members"}
        <AddMembers
            busy={savingMembers}
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            on:saveMembers={saveMembers}
            on:cancelAddMembers={popHistory} />
    {:else if lastState.kind === "show_members" && $selectedChatId !== undefined}
        <Members
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            chat={groupChat}
            {userId}
            members={currentChatMembers}
            blockedUsers={currentChatBlockedUsers}
            on:close={popHistory}
            on:blockUser={onBlockUser}
            on:unblockUser={unblockUser}
            on:transferOwnership={onTransferOwnership}
            on:chatWith
            on:addMembers
            on:dismissAsAdmin={onDismissAsAdmin}
            on:removeMember={onRemoveMember}
            on:makeAdmin={onMakeAdmin} />
    {:else if lastState.kind === "show_pinned" && $selectedChatId !== undefined}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            chatId={$selectedChatId}
            pinned={$currentChatPinnedMessages}
            on:close={popHistory} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:upgrade
            on:showFaqQuestion
            {user}
            {metrics}
            on:userAvatarSelected
            on:closeProfile={popHistory} />
    {:else if lastState.kind === "new_group_panel"}
        <NewGroup {currentUser} on:cancelNewGroup={popHistory} on:groupCreated />
    {:else if threadRootEvent !== undefined && $selectedChatStore !== undefined}
        <Thread
            bind:this={thread}
            on:chatWith
            on:upgrade
            rootEvent={threadRootEvent}
            focusMessageIndex={lastState.kind === "message_thread_panel"
                ? lastState.focusThreadMessageIndex
                : undefined}
            chat={$selectedChatStore}
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChatId !== undefined}
        <ProposalGroupFilters on:close={popHistory} />
    {/if}
    {#if $screenWidth === ScreenWidth.ExtraExtraLarge}
        <BackgroundLogo
            width={"700px"}
            bottom={"-16px"}
            right={"-16px"}
            opacity={"0.35"}
            viewBox={"0 0 361 280"} />
    {/if}
</Panel>
