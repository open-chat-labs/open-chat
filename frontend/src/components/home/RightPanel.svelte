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
    import type { ChatMetrics, FullParticipant, GroupChatSummary } from "../../domain/chat/chat";
    import type { ChatController } from "../../fsm/chat.controller";
    import { userStore } from "../../stores/user";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import { nullUser } from "../../domain/user/user.utils";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import { currentUserKey } from "../../fsm/home.controller";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { Readable, writable } from "svelte/store";
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    const dispatch = createEventDispatcher();

    export let controller: ChatController | undefined;
    export let rightPanelHistory: RightPanelState[];
    export let userId: string;
    export let metrics: ChatMetrics;

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

    function pop() {
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
            pop();
        } else {
            toastStore.showFailureToast("addParticipantsFailed");
        }
        savingParticipants = false;
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        if (modal) {
            pop();
        }
    }
</script>

<Panel right>
    {#if lastState.kind === "group_details" && controller !== undefined}
        <GroupDetails
            chat={$groupChat}
            participantCount={$participants.length}
            on:close={pop}
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
            on:cancelAddParticipants={pop} />
    {:else if lastState.kind === "show_participants" && controller !== undefined}
        <Participants
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            {controller}
            {userId}
            on:close={pop}
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
            on:close={pop} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:upgrade
            on:showFaqQuestion
            {user}
            {metrics}
            on:userAvatarSelected
            on:closeProfile={pop} />
    {:else if lastState.kind === "new_group_panel"}
        <NewGroup {currentUser} on:cancelNewGroup={pop} on:groupCreated />
    {:else if lastState.kind === "message_thread_panel" && controller !== undefined}
        <Thread
            rootEvent={lastState.rootEvent}
            {controller}
            threadSummary={lastState.threadSummary}
            on:close={pop} />
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
