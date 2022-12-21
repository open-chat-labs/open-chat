<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import GroupDetails from "./GroupDetails.svelte";
    import GroupVisibility from "./GroupVisibility.svelte";
    import Rules from "../groupdetails/Rules.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import { toastStore } from "../../../stores/toast";
    import ChooseMembers from "./ChooseMembers.svelte";
    import {
        CandidateGroupChat,
        CreateGroupResponse,
        defaultGroupRules,
        OpenChat,
        UnsupportedValueError,
    } from "openchat-client";
    import StageHeader from "./StageHeader.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { push } from "svelte-spa-router";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    let candidateGroup: CandidateGroupChat = defaultCandidateGroup();
    let busy = false;
    let bodyElement: HTMLDivElement;
    let step = 0;
    let user = client.user;
    $: left = step * 550;
    $: valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;

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

    function createOrChooseMembers() {
        if (!candidateGroup.isPublic) {
            // newGroupState = "choosing_members";
        } else {
            createGroup();
        }
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
        if (resp.kind === "user_suspended") return "userSuspended";
        throw new UnsupportedValueError(`Unexpected CreateGroupResponse type received`, resp);
    }

    function optionallyAddMembers(canisterId: string): Promise<void> {
        if (candidateGroup.members.length === 0) {
            return Promise.resolve();
        }
        return client
            .addMembers(
                canisterId,
                candidateGroup.members.map((m) => m.user.userId),
                user.username,
                false
            )
            .then((resp) => {
                if (resp.kind !== "add_members_success") {
                    Promise.reject("Unable to add members to the new group");
                }
            });
    }

    function createGroup() {
        busy = true;

        client
            .createGroupChat(user.userId, candidateGroup)
            .then((resp) => {
                if (resp.kind !== "success") {
                    const err = groupCreationErrorMessage(resp);
                    if (err) toastStore.showFailureToast(err);
                    step = 0;
                } else {
                    return optionallyAddMembers(resp.canisterId)
                        .then(() => {
                            onGroupCreated(resp.canisterId);
                        })
                        .catch((err) => {
                            toastStore.showFailureToast("addMembersFailed");
                            step = 0;
                        });
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("groupCreationFailed");
                step = 0;
            })
            .finally(() => (busy = false));
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

    function reset() {
        step = 0;
        busy = false;
        candidateGroup = defaultCandidateGroup();
    }
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">{$_("createNewGroup")}</div>
    <div class="body" bind:this={bodyElement} slot="body">
        <StageHeader {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details">
                    <GroupDetails bind:candidateGroup />
                </div>
                <div class="visibility">
                    <GroupVisibility bind:candidateGroup />
                </div>
                <div class="rules">
                    <Rules bind:rules={candidateGroup.rules} />
                </div>
                <div class="permissions">
                    <GroupPermissionsEditor
                        bind:permissions={candidateGroup.permissions}
                        isPublic={candidateGroup.isPublic} />
                </div>
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <div class="back">
            {#if step > 0}
                <Button disabled={busy} small on:click={() => (step = step - 1)}>Back</Button>
            {/if}
        </div>
        <ButtonGroup align="end">
            <Button disabled={false} small on:click={() => dispatch("close")} secondary
                >{$_("cancel")}</Button>
            {#if step < 3}
                <Button disabled={!valid} small on:click={() => (step = step + 1)}>Next</Button>
            {:else}
                <Button disabled={busy} loading={busy} small on:click={createGroup}
                    >Create group</Button>
            {/if}
        </ButtonGroup>
    </span>
</ModalContent>

<style type="text/scss">
    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .wrapper {
        width: 100%;
        overflow: hidden;
        height: 550px;
        position: relative;
    }

    .sections {
        display: flex;
        transition: left 250ms ease-in-out;
        position: relative;
        gap: $sp5;
        height: 100%;
        @include mobile() {
            gap: $sp4;
        }
    }

    .details,
    .visibility,
    .rules,
    .permissions {
        flex: 0 0 100%;
    }

    .permissions {
        @include nice-scrollbar();
    }
</style>
