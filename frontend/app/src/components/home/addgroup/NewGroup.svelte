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
    import { mobileWidth } from "../../../stores/screenDimensions";
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
    let step = 0;
    let user = client.user;
    let actualWidth = 0;
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;
    $: finalStep = candidateGroup.isPublic ? 3 : 4;

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

    function changeStep(ev: CustomEvent<number>) {
        if (valid) {
            step = ev.detail;
        }
    }
</script>

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">{$_("group.createTitle")}</div>
    <div class="body" slot="body">
        <StageHeader {candidateGroup} enabled={valid} on:step={changeStep} {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details" class:visible={step === 0}>
                    <GroupDetails bind:candidateGroup />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <GroupVisibility bind:candidateGroup />
                </div>
                <div class="rules" class:visible={step === 2}>
                    <Rules bind:rules={candidateGroup.rules} />
                </div>
                <div class="permissions" class:visible={step === 3}>
                    <GroupPermissionsEditor
                        bind:permissions={candidateGroup.permissions}
                        isPublic={candidateGroup.isPublic} />
                </div>
                {#if !candidateGroup.isPublic}
                    <div class="members" class:visible={step === 4}>
                        <ChooseMembers bind:candidateGroup {busy} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <div class="back">
            {#if step > 0}
                <Button
                    disabled={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => (step = step - 1)}>{$_("group.back")}</Button>
            {/if}
        </div>
        <ButtonGroup align="end">
            <Button
                disabled={false}
                small={!$mobileWidth}
                tiny={$mobileWidth}
                on:click={() => dispatch("close")}
                secondary>{$_("cancel")}</Button>
            {#if step < finalStep}
                <Button
                    disabled={!valid}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => (step = step + 1)}>
                    {$_("group.next")}
                </Button>
            {:else}
                <Button
                    disabled={busy}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={createGroup}>{$_("group.create")}</Button>
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

        @include mobile() {
            height: 400px;
        }
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
    .members,
    .permissions {
        flex: 0 0 100%;
        visibility: hidden;
        transition: visibility 250ms ease-in-out;
        @include nice-scrollbar();

        &.visible {
            visibility: visible;
        }
    }
</style>
