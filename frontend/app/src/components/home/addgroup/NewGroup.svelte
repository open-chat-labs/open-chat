<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import GroupDetails from "./GroupDetails.svelte";
    import Rules from "../Rules.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import { toastStore } from "../../../stores/toast";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ChooseMembers from "../ChooseMembers.svelte";
    import {
        CandidateGroupChat,
        CreateGroupResponse,
        AccessGate,
        OpenChat,
        UnsupportedValueError,
        UpdateGroupResponse,
        GroupChatIdentifier,
    } from "openchat-client";
    import StageHeader from "../StageHeader.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import page from "page";
    import AreYouSure from "../../AreYouSure.svelte";
    import VisibilityControl from "../VisibilityControl.svelte";
    import { interpolateLevel } from "../../../utils/i18n";
    import { routeForChatIdentifier } from "routes";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    export let candidateGroup: CandidateGroupChat;

    let confirming = false;
    let busy = false;
    let step = 0;
    let actualWidth = 0;
    let originalGroup = {
        ...candidateGroup,
        rules: { ...candidateGroup.rules },
        permissions: { ...candidateGroup.permissions },
        gate: { ...candidateGroup.gate },
    };
    let rulesValid = true;
    $: steps = getSteps(editing);
    $: editing = candidateGroup.chatId.id !== "";
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;
    $: canEditPermissions = !editing ? true : client.canChangePermissions(candidateGroup.chatId);

    $: permissionsDirty = client.havePermissionsChanged(
        originalGroup.permissions,
        candidateGroup.permissions
    );
    $: rulesDirty =
        editing &&
        candidateGroup.rules !== undefined &&
        (candidateGroup.rules.enabled !== originalGroup.rules.enabled ||
            candidateGroup.rules.text !== originalGroup.rules.text);
    $: nameDirty = editing && candidateGroup.name !== originalGroup.name;
    $: descDirty = editing && candidateGroup.description !== originalGroup.description;
    $: avatarDirty = editing && candidateGroup.avatar?.blobUrl !== originalGroup.avatar?.blobUrl;
    $: visDirty = editing && candidateGroup.public !== originalGroup.public;
    $: infoDirty = nameDirty || descDirty || avatarDirty;
    $: gateDirty = client.hasAccessGateChanged(candidateGroup.gate, originalGroup.gate);
    $: dirty = infoDirty || rulesDirty || permissionsDirty || visDirty || gateDirty;

    function getSteps(editing: boolean) {
        let steps = [
            { labelKey: "group.details", valid: true },
            { labelKey: "access.visibility", valid: true },
            { labelKey: interpolateLevel("rules.rules", candidateGroup.level), valid: true },
            { labelKey: "permissions.permissions", valid: true },
        ];

        if (!editing) {
            steps.push({ labelKey: "group.invite.invite", valid: true });
        }
        return steps;
    }

    function interpolateError(error: string): string {
        return interpolateLevel(error, candidateGroup.level, true);
    }

    function groupUpdateErrorMessage(resp: UpdateGroupResponse): string | undefined {
        if (resp === "success") return undefined;
        if (resp === "unchanged") return undefined;
        if (resp === "name_too_short") return "groupNameTooShort";
        if (resp === "name_too_long") return "groupNameTooLong";
        if (resp === "name_reserved") return "groupNameReserved";
        if (resp === "desc_too_long") return "groupDescTooLong";
        if (resp === "name_taken") return "groupAlreadyExists";
        if (resp === "not_in_group") return "userNotInGroup";
        if (resp === "internal_error") return "groupUpdateFailed";
        if (resp === "not_authorized") return "groupUpdateFailed";
        if (resp === "avatar_too_big") return "avatarTooBig";
        if (resp === "rules_too_short") return "groupRulesTooShort";
        if (resp === "rules_too_long") return "groupRulesTooLong";
        if (resp === "user_suspended") return "userSuspended";
        if (resp === "chat_frozen") return "chatFrozen";
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
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
        if (resp.kind === "unauthorized_to_create_public_group")
            return "unauthorizedToCreatePublicGroup";
        throw new UnsupportedValueError(`Unexpected CreateGroupResponse type received`, resp);
    }

    function optionallyInviteUsers(chatId: GroupChatIdentifier): Promise<void> {
        if (candidateGroup.members.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                candidateGroup.members.map((m) => m.user.userId)
            )
            .then((resp) => {
                if (resp !== "success") {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }

    function updateGroup(yes: boolean = true): Promise<void> {
        busy = true;

        const makePrivate = visDirty && !candidateGroup.public && originalGroup.public;

        if (makePrivate && !confirming) {
            confirming = true;
            return Promise.resolve();
        }

        if (makePrivate && confirming && !yes) {
            confirming = false;
            busy = false;
            candidateGroup.public = true;
            return Promise.resolve();
        }

        confirming = false;

        const p1 = infoDirty ? doUpdateInfo() : Promise.resolve();
        const p2 = permissionsDirty ? doUpdatePermissions() : Promise.resolve();
        const p3 = rulesDirty && rulesValid ? doUpdateRules() : Promise.resolve();
        const p4 = makePrivate ? doMakeGroupPrivate() : Promise.resolve();
        const p5 = gateDirty ? doUpdateGate(candidateGroup.gate) : Promise.resolve();

        return Promise.all([p1, p2, p3, p4, p5])
            .then((_) => {
                return;
            })
            .finally(() => {
                busy = false;
                dispatch("close");
            });
    }

    function doMakeGroupPrivate(): Promise<void> {
        if (!editing) return Promise.resolve();

        return client.makeGroupPrivate(candidateGroup.chatId).then((success) => {
            if (success) {
                originalGroup = {
                    ...originalGroup,
                    public: candidateGroup.public,
                };
            } else {
                toastStore.showFailureToast("makeGroupPrivateFailed");
            }
        });
    }

    function doUpdatePermissions(): Promise<void> {
        if (!editing) return Promise.resolve();

        return client
            .updateGroupPermissions(
                candidateGroup.chatId,
                originalGroup.permissions,
                candidateGroup.permissions
            )
            .then((success) => {
                if (success) {
                    // TODO this doesn't seem to update properly
                    originalGroup = {
                        ...originalGroup,
                        permissions: { ...candidateGroup.permissions },
                    };
                } else {
                    toastStore.showFailureToast("group.permissionsUpdateFailed");
                }
            });
    }

    function doUpdateGate(gate: AccessGate): Promise<void> {
        if (!editing) return Promise.resolve();

        return client
            .updateGroup(
                candidateGroup.chatId,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                gate
            )
            .then((resp) => {
                const err = groupUpdateErrorMessage(resp);
                if (err) {
                    toastStore.showFailureToast(interpolateError(err));
                } else {
                    originalGroup = {
                        ...originalGroup,
                        ...candidateGroup.gate,
                    };
                }
            })
            .catch(() => {
                toastStore.showFailureToast("groupUpdateFailed", {
                    values: { level: candidateGroup.level },
                });
            });
    }

    function doUpdateRules(): Promise<void> {
        if (!editing) return Promise.resolve();

        return client
            .updateGroupRules(candidateGroup.chatId, candidateGroup.rules)
            .then((success) => {
                if (success) {
                    dispatch("updateGroupRules", {
                        chatId: candidateGroup.chatId,
                        rules: candidateGroup.rules,
                    });
                } else {
                    toastStore.showFailureToast(interpolateError("group.rulesUpdateFailed"));
                }
            });
    }

    function doUpdateInfo(): Promise<void> {
        if (!editing) return Promise.resolve();

        return client
            .updateGroup(
                candidateGroup.chatId,
                nameDirty ? candidateGroup.name : undefined,
                descDirty ? candidateGroup.description : undefined,
                undefined,
                undefined,
                avatarDirty ? candidateGroup.avatar?.blobData : undefined,
                undefined
            )
            .then((resp) => {
                const err = groupUpdateErrorMessage(resp);
                if (err) {
                    toastStore.showFailureToast(interpolateError(err));
                } else {
                    originalGroup = {
                        ...originalGroup,
                        ...candidateGroup.avatar,
                        name: candidateGroup.name,
                        description: candidateGroup.description,
                    };
                }
            })
            .catch(() => {
                toastStore.showFailureToast("groupUpdateFailed", {
                    values: { level: candidateGroup.level },
                });
            });
    }

    function createGroup() {
        busy = true;

        client
            .createGroupChat(candidateGroup)
            .then((resp) => {
                if (resp.kind !== "success") {
                    const err = groupCreationErrorMessage(resp);
                    if (err) toastStore.showFailureToast(interpolateError(err));
                    step = 0;
                } else {
                    const chatId: GroupChatIdentifier = { kind: "group_chat", id: resp.canisterId };
                    return optionallyInviteUsers(chatId)
                        .then(() => {
                            onGroupCreated(chatId);
                        })
                        .catch((err) => {
                            toastStore.showFailureToast("inviteUsersFailed");
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

    function onGroupCreated(canisterId: GroupChatIdentifier) {
        const url = routeForChatIdentifier(canisterId);
        dispatch("groupCreated", {
            chatId: canisterId,
            public: candidateGroup.public,
            rules: candidateGroup.rules,
        });
        dispatch("close");

        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => page(url)); // trigger the selection of the chat
    }

    function changeStep(ev: CustomEvent<number>) {
        if (valid) {
            step = ev.detail;
        }
    }
</script>

{#if confirming}
    <AreYouSure message={$_("confirmMakeGroupPrivate")} action={updateGroup} />
{/if}

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">
        {editing
            ? interpolateLevel("group.edit", candidateGroup.level, true)
            : interpolateLevel("group.createTitle", candidateGroup.level, true)}
    </div>
    <div class="body" slot="body">
        <StageHeader {steps} enabled={valid} on:step={changeStep} {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details" class:visible={step === 0}>
                    <GroupDetails {busy} bind:candidateGroup />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <VisibilityControl
                        on:upgrade
                        original={originalGroup}
                        {editing}
                        bind:candidate={candidateGroup} />
                </div>
                <div class="rules" class:visible={step === 2}>
                    <Rules
                        bind:valid={rulesValid}
                        level={candidateGroup.level}
                        bind:rules={candidateGroup.rules} />
                </div>
                <div use:menuCloser class="permissions" class:visible={step === 3}>
                    {#if canEditPermissions}
                        <GroupPermissionsEditor
                            bind:permissions={candidateGroup.permissions}
                            isPublic={candidateGroup.public} />
                    {:else}
                        <GroupPermissionsViewer
                            bind:permissions={candidateGroup.permissions}
                            isPublic={candidateGroup.public} />
                    {/if}
                </div>
                {#if !editing}
                    <div class="members" class:visible={step === 4}>
                        <ChooseMembers bind:members={candidateGroup.members} {busy} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <div class="group-buttons">
            <div class="back">
                {#if !editing && step > 0}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step - 1)}>{$_("group.back")}</Button>
                {/if}
            </div>
            <div class="actions">
                <Button
                    disabled={false}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => dispatch("close")}
                    secondary>{$_("cancel")}</Button>

                {#if editing}
                    <Button
                        disabled={!dirty || busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => updateGroup()}
                        >{interpolateLevel("group.update", candidateGroup.level, true)}</Button>
                {:else if step < steps.length - 1}
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
                        on:click={createGroup}
                        >{interpolateLevel("group.create", candidateGroup.level, true)}</Button>
                {/if}
            </div>
        </div>
    </span>
</ModalContent>

<style lang="scss">
    :global(.group-buttons button:not(.loading)) {
        @include mobile() {
            min-width: 0 !important;
        }
    }

    :global(.group-buttons .actions button) {
        height: auto;
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .group-buttons {
        display: flex;
        justify-content: space-between;
        width: 100%;
        gap: $sp3;

        .back {
            display: flex;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: $sp3;
        }
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
