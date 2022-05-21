<script lang="ts">
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import type { RightPanelState } from "../../fsm/rightPanel";
    import type { ChatMetrics, FullParticipant } from "../../domain/chat/chat";
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
    import BackgroundLogo from "../BackgroundLogo.svelte";
    const dispatch = createEventDispatcher();

    export let rightPanelHistory: RightPanelState[];
    export let userId: string;
    export let metrics: ChatMetrics;

    const api = getContext<ServiceContainer>(apiKey);
    const currentUser = getContext<CreatedUser>(currentUserKey);

    let savingParticipants = false;
    let profileComponent: UserProfile;

    $: user = $userStore[userId] ?? nullUser("unknown");
    $: lastState = rightPanelHistory[rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = $screenWidth !== ScreenWidth.ExtraExtraLarge;

    export function showProfile() {
        profileComponent.reset();
    }

    /** quite a few handlers require a controller which we don't always have. This wrapper just streamlines that a bit */
    function withController<T>(fn: (controller: ChatController, ev: CustomEvent<T>) => void) {
        return (ev: CustomEvent<T>) => {
            if ("controller" in lastState) {
                fn(lastState.controller, ev);
            }
        };
    }

    function dismissAsAdmin(controller: ChatController, ev: CustomEvent<string>): void {
        controller.dismissAsAdmin(ev.detail);
    }

    function makeAdmin(controller: ChatController, ev: CustomEvent<string>): void {
        controller.makeAdmin(ev.detail);
    }

    function removeParticipant(controller: ChatController, ev: CustomEvent<string>): void {
        controller.participants.update((ps) => ps.filter((p) => p.userId !== ev.detail));
        controller.removeParticipant(ev.detail);
    }

    function pop() {
        rightPanelHistory = rightPanelHistory.slice(0, rightPanelHistory.length - 1);
    }

    function blockUser(controller: ChatController, ev: CustomEvent<{ userId: string }>) {
        controller.blockUser(ev.detail.userId);
    }

    async function transferOwnership(controller: ChatController, ev: CustomEvent<FullParticipant>) {
        const success = await controller.transferOwnership(userId, ev.detail);
        if (success) {
            toastStore.showSuccessToast("transferOwnershipSucceeded");
        } else {
            toastStore.showFailureToast("transferOwnershipFailed");
        }
    }

    async function unblockUser(controller: ChatController, ev: CustomEvent<UserSummary>) {
        const success = await controller.addParticipants(true, [ev.detail]);
        if (success) {
            toastStore.showSuccessToast("unblockUserSucceeded");
        } else {
            toastStore.showFailureToast("unblockUserFailed");
        }
    }

    async function saveParticipants(controller: ChatController, ev: CustomEvent<UserSummary[]>) {
        savingParticipants = true;
        const success = await controller.addParticipants(false, ev.detail);
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
    {#if lastState.kind === "group_details"}
        <GroupDetails
            state={lastState}
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
            on:saveParticipants={withController(saveParticipants)}
            on:cancelAddParticipants={pop} />
    {:else if lastState.kind === "show_participants"}
        <Participants
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            controller={lastState.controller}
            {userId}
            on:close={pop}
            on:blockUser={withController(blockUser)}
            on:unblockUser={withController(unblockUser)}
            on:transferOwnership={withController(transferOwnership)}
            on:chatWith
            on:addParticipants
            on:dismissAsAdmin={withController(dismissAsAdmin)}
            on:removeParticipant={withController(removeParticipant)}
            on:makeAdmin={withController(makeAdmin)} />
    {:else if lastState.kind === "show_pinned"}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            state={lastState}
            on:close={pop} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            bind:this={profileComponent}
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:upgrade
            on:showFaqQuestion
            {user}
            {metrics}
            on:userAvatarSelected
            on:closeProfile={pop} />
    {:else if lastState.kind === "new_group_panel"}
        <NewGroup {currentUser} on:cancelNewGroup={pop} on:groupCreated />
    {/if}
    <BackgroundLogo
        size={"700px"}
        bottom={"-200px"}
        right={"50px"}
        left={"unset"}
        opacity={"0.3"} />
    <BackgroundLogo
        size={"1200px"}
        bottom={"150px"}
        left={"-150px"}
        right={"unset"}
        opacity={"0.15"} />
</Panel>
