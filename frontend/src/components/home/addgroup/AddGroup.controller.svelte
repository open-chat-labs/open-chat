<script lang="ts">
    import NewGroup from "./NewGroup.svelte";
    import ChooseParticipants from "./ChooseParticipants.svelte";
    import type { NewGroupState } from "../../../fsm/newGroup";
    import type { CandidateGroupChat, CreateGroupResponse } from "../../../domain/chat/chat";
    import type { User } from "../../../domain/user/user";
    import { toastStore } from "../../../stores/toast";
    import { rollbar } from "../../../utils/logging";
    import { push } from "svelte-spa-router";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { groupChatFromCandidate } from "domain/chat/chat.utils";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";

    const api: ServiceContainer = getContext(apiKey);
    const dispatch = createEventDispatcher();

    export let currentUser: User;

    let newGroupState: NewGroupState = "group_form";
    let creatingCanister = false;
    let addingParticipants = false;
    let canisterId: string | undefined;
    let candidateGroup: CandidateGroupChat = defaultCandidateGroup();

    function reset() {
        newGroupState = "group_form";
        creatingCanister = false;
        addingParticipants = false;
        canisterId = undefined;
        candidateGroup = defaultCandidateGroup();
    }

    function defaultCandidateGroup(): CandidateGroupChat {
        return {
            name: "",
            description: "",
            historyVisible: true,
            isPublic: false,
            participants: [],
            permissions: {
                changePermissions: "admins",
                changeRoles: "admins",
                addMembers: "admins",
                removeMembers: "admins",
                blockUsers: "admins",
                deleteMessages: "admins",
                updateGroup: "admins",
                pinMessages: "admins",
                inviteUsers: "admins",
                createPolls: "members",
                sendMessages: "members",
                reactToMessages: "members",
            },
        };
    }

    function groupCreationErrorMessage(resp: CreateGroupResponse): string | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "description_too_long") return "groupDescTooLong";
        if (resp.kind === "internal_error") return "groupCreationFailed";
        if (resp.kind === "invalid_name") return "groupNameInvalid";
        if (resp.kind === "name_too_long") return "groupNameTooLong";
        if (resp.kind === "group_name_taken") return "groupAlreadyExists";
        if (resp.kind === "throttled") return "groupCreationFailed";
        if (resp.kind === "max_groups_created") return "maxGroupsCreated";
    }

    function onCreateGroup() {
        if (canisterId === undefined) {
            creatingCanister = true;

            if (!candidateGroup.isPublic) {
                newGroupState = "choosing_participants";
            }

            api.createGroupChat(candidateGroup)
                .then((resp) => {
                    if (resp.kind !== "success") {
                        const err = groupCreationErrorMessage(resp);
                        if (err) toastStore.showFailureToast(err);
                        newGroupState = "group_form";
                    } else {
                        canisterId = resp.canisterId;
                        if (candidateGroup.isPublic) {
                            onGroupCreated();
                        }
                    }
                })
                .catch((err) => {
                    rollbar.error("Unable to create group", err);
                    toastStore.showFailureToast("groupCreationFailed");
                    newGroupState = "group_form";
                })
                .finally(() => (creatingCanister = false));
        }
    }

    function complete() {
        if (canisterId !== undefined) {
            addingParticipants = true;
            api.addParticipants(
                canisterId,
                candidateGroup.participants.map((p) => p.user.userId),
                currentUser.username,
                false
            )
                .then((resp) => {
                    if (resp.kind === "add_participants_success") {
                        onGroupCreated();
                    } else {
                        toastStore.showFailureToast("addParticipantsFailed");
                    }
                })
                .catch((err) => {
                    rollbar.error("Unable to add participants to group", err);
                    toastStore.showFailureToast("addParticipantsFailed");
                })
                .finally(() => (addingParticipants = false));
        }
    }

    function onGroupCreated() {
        if (canisterId !== undefined) {
            const url = `/${canisterId}`;
            dispatch(
                "groupCreated",
                groupChatFromCandidate(currentUser.userId, canisterId, candidateGroup)
            );
            reset();

            // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
            tick().then(() => push(url)); // trigger the selection of the chat
        }
    }
</script>

{#if newGroupState === "group_form"}
    <NewGroup
        {creatingCanister}
        bind:candidateGroup
        on:cancelNewGroup
        on:createGroup={onCreateGroup} />
{:else if newGroupState === "choosing_participants"}
    <ChooseParticipants
        {creatingCanister}
        {addingParticipants}
        bind:candidateGroup
        on:complete={complete} />
{/if}
