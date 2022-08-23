<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import type { RightPanelState } from "../../fsm/rightPanel";
    import type {
        ChatEvent,
        ChatMetrics,
        EventWrapper,
        FullParticipant,
        GroupChatSummary,
        Message,
    } from "../../domain/chat/chat";
    import type { ChatController } from "../../fsm/chat.controller";
    import { userStore } from "../../stores/user";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import { nullUser } from "../../domain/user/user.utils";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import { currentUserKey } from "../../stores/user";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { Readable, writable } from "svelte/store";
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    import { replace, querystring } from "svelte-spa-router";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam } from "utils/urls";

    const dispatch = createEventDispatcher();

    export let controller: ChatController | undefined;
    export let rightPanelHistory: RightPanelState[];
    export let userId: string;
    export let metrics: ChatMetrics;
    export let thread: Thread | undefined;

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    let savingParticipants = false;

    $: user = $userStore[userId] ?? nullUser("unknown");
    $: lastState = rightPanelHistory[rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = $numberOfColumns === 2;
    $: groupChat = controller?.chat as Readable<GroupChatSummary>;
    $: participants = controller?.participants ?? writable([]);
    $: pinned = controller?.pinnedMessages ?? writable(new Set<number>());
    $: chatId = controller?.chatId;
    $: events = controller?.events;

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        controller?.dismissAsAdmin(ev.detail);
    }

    function makeAdmin(ev: CustomEvent<string>): void {
        controller?.makeAdmin(ev.detail);
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        controller?.participants.update((ps) => ps.filter((p) => p.userId !== ev.detail));
        controller?.removeParticipant(ev.detail);
    }

    function popHistory() {
        rightPanelHistory = rightPanelHistory.slice(0, rightPanelHistory.length - 1);
    }

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        controller?.blockUser(ev.detail.userId);
    }

    async function transferOwnership(ev: CustomEvent<FullParticipant>) {
        const success = await controller?.transferOwnership(userId, ev.detail);
        if (success) {
            toastStore.showSuccessToast("transferOwnershipSucceeded");
        } else {
            toastStore.showFailureToast("transferOwnershipFailed");
        }
    }

    async function unblockUser(ev: CustomEvent<UserSummary>) {
        const success = await controller?.addParticipants(true, [ev.detail]);
        if (success) {
            toastStore.showSuccessToast("unblockUserSucceeded");
        } else {
            toastStore.showFailureToast("unblockUserFailed");
        }
    }

    async function saveParticipants(ev: CustomEvent<UserSummary[]>) {
        savingParticipants = true;
        const success = await controller?.addParticipants(false, ev.detail);
        if (success) {
            popHistory();
        } else {
            toastStore.showFailureToast("addParticipantsFailed");
        }
        savingParticipants = false;
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
        lastState.kind === "message_thread_panel" && events !== undefined
            ? findMessage($events ?? [], lastState.rootEvent.event.messageId)
            : undefined;
</script>

<Panel right>
    {#if lastState.kind === "group_details" && controller !== undefined}
        <GroupDetails
            chat={$groupChat}
            participantCount={$participants.length}
            on:close={popHistory}
            on:deleteGroup
            on:makeGroupPrivate
            on:chatWith
            on:showParticipants
            on:updateChat />
    {:else if lastState.kind === "add_participants"}
        <AddParticipants
            busy={savingParticipants}
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            on:saveParticipants={saveParticipants}
            on:cancelAddParticipants={popHistory} />
    {:else if lastState.kind === "show_participants" && controller !== undefined}
        <Participants
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            {controller}
            {userId}
            on:close={popHistory}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:transferOwnership={transferOwnership}
            on:chatWith
            on:addParticipants
            on:dismissAsAdmin={dismissAsAdmin}
            on:removeParticipant={removeParticipant}
            on:makeAdmin={makeAdmin} />
    {:else if lastState.kind === "show_pinned" && chatId !== undefined}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            {chatId}
            pinned={$pinned}
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
    {:else if threadRootEvent !== undefined && controller !== undefined}
        <Thread
            bind:this={thread}
            on:chatWith
            on:upgrade
            rootEvent={threadRootEvent}
            focusMessageIndex={lastState.kind === "message_thread_panel"
                ? lastState.focusThreadMessageIndex
                : undefined}
            {controller}
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && controller !== undefined}
        <ProposalGroupFilters {controller} on:close={popHistory} />
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
