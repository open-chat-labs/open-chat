<script lang="ts">
    import { _ } from "svelte-i18n";
    import NewGroup from "./NewGroup.svelte";
    import ChooseMembers from "./ChooseMembers.svelte";
    import { defaultGroupRules } from "openchat-client";
    import { UnsupportedValueError } from "openchat-client";
    import type {
        User,
        CandidateGroupChat,
        CreateGroupResponse,
        NewGroupState,
    } from "openchat-client";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import { push } from "svelte-spa-router";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let currentUser: User;

    let newGroupState: NewGroupState = "group_form";
    let busy = false;
    let candidateGroup: CandidateGroupChat = defaultCandidateGroup();

    function reset() {
        newGroupState = "group_form";
        busy = false;
        candidateGroup = defaultCandidateGroup();
    }

    function defaultCandidateGroup(): CandidateGroupChat {
        return {
            name: "",
            description: "",
            historyVisible: true,
            isPublic: false,
            members: [],
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
                replyInThread: "members",
            },
            rules: {
                text: defaultGroupRules,
                enabled: false,
            },
        };
    }

    function groupCreationErrorMessage(resp: CreateGroupResponse): string | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "internal_error") return "groupCreationFailed";
        if (resp.kind === "name_too_short") return "groupNameTooShort";
        if (resp.kind === "name_too_long") return "groupNameTooLong";
        if (resp.kind === "name_reserved") return "groupNameReserved";
        if (resp.kind === "description_too_long") return "groupDescTooLong";
        if (resp.kind === "group_name_taken") return "groupAlreadyExists";
        if (resp.kind === "avatar_too_big") return "groupAvatarTooBig";
        if (resp.kind === "max_groups_created") return "maxGroupsCreated";
        if (resp.kind === "throttled") return "groupCreationFailed";
        if (resp.kind === "rules_too_short") return "groupRulesTooShort";
        if (resp.kind === "rules_too_long") return "groupRulesTooLong";
        if (resp.kind === "user_suspended") return "groupRulesTooLong";
        throw new UnsupportedValueError(`Unexpected CreateGroupResponse type received`, resp);
    }

    function createGroup() {
        busy = true;

        client
            .createGroupChat(currentUser.userId, candidateGroup)
            .then((resp) => {
                if (resp.kind !== "success") {
                    const err = groupCreationErrorMessage(resp);
                    if (err) toastStore.showFailureToast(err);
                    newGroupState = "group_form";
                } else {
                    return optionallyAddMembers(resp.canisterId)
                        .then(() => {
                            onGroupCreated(resp.canisterId);
                        })
                        .catch((err) => {
                            logger.error("Unable to add members to group", err);
                            toastStore.showFailureToast("addMembersFailed");
                            newGroupState = "group_form";
                        });
                }
            })
            .catch((err) => {
                logger.error("Unable to create group", err);
                toastStore.showFailureToast("groupCreationFailed");
                newGroupState = "group_form";
            })
            .finally(() => (busy = false));
    }

    function optionallyAddMembers(canisterId: string): Promise<void> {
        if (candidateGroup.members.length === 0) {
            return Promise.resolve();
        }
        return client
            .addMembers(
                canisterId,
                candidateGroup.members.map((m) => m.user.userId),
                currentUser.username,
                false
            )
            .then((resp) => {
                if (resp.kind !== "add_members_success") {
                    Promise.reject("Unable to add members to the new group");
                }
            });
    }

    function createOrChooseMembers() {
        if (!candidateGroup.isPublic) {
            newGroupState = "choosing_members";
        } else {
            createGroup();
        }
    }

    function onGroupCreated(canisterId: string) {
        const url = `/${canisterId}`;
        dispatch("groupCreated", {
            chatId: canisterId,
            isPublic: candidateGroup.isPublic,
            rules: candidateGroup.rules,
        });
        reset();

        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => push(url)); // trigger the selection of the chat
    }
</script>

{#if newGroupState === "group_form"}
    <NewGroup {busy} bind:candidateGroup on:cancelNewGroup on:createGroup={createOrChooseMembers} />
{:else if newGroupState === "choosing_members"}
    <ChooseMembers {busy} bind:candidateGroup on:complete={createGroup} />
{/if}
