<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import GroupDetails from "./GroupDetails.svelte";
    import RulesEditor from "../RulesEditor.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import { toastStore } from "../../../stores/toast";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ChooseMembers from "../ChooseMembers.svelte";
    import {
        type CandidateGroupChat,
        type CreateGroupResponse,
        type OpenChat,
        UnsupportedValueError,
        type UpdateGroupResponse,
        routeForChatIdentifier,
        chatIdentifierUnset,
        type MultiUserChatIdentifier,
        type UserSummary,
        type Level,
        type ResourceKey,
        chatListScopeStore as chatListScope,
        selectedCommunity,
    } from "openchat-client";
    import StageHeader from "../StageHeader.svelte";
    import { getContext, tick } from "svelte";
    import page from "page";
    import AreYouSure from "../../AreYouSure.svelte";
    import VisibilityControl from "../VisibilityControl.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        templateGroup: CandidateGroupChat;
        embeddedContent: boolean;
        onClose: () => void;
        onUpgrade: () => void;
    }

    let { templateGroup, embeddedContent, onClose, onUpgrade }: Props = $props();
    let confirming = $state(false);
    let showingVerificationWarning = $state(false);
    let busy = $state(false);
    let step = $state("details");
    let actualWidth = $state(0);
    let detailsValid = $state(true);
    let visibilityValid = $state(true);
    let originalGroup = $state(structuredClone(templateGroup));

    //TODO: we need to clone the candidate as well here *solely* because Home.svelte is current Svelte 4
    let candidateGroup = $state(structuredClone(templateGroup));
    let rulesValid = $state(true);

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        visibilityValid: boolean,
        rulesValid: boolean,
        hideInviteUsers: boolean,
        embeddedContent: boolean,
    ) {
        let steps = [
            { key: "details", labelKey: "group.details", valid: detailsValid },
            { key: "visibility", labelKey: "access.visibility", valid: visibilityValid },
        ];

        if (!embeddedContent) {
            steps.push({ key: "rules", labelKey: "rules.rules", valid: rulesValid });
        }

        steps.push({ key: "permissions", labelKey: "permissions.permissions", valid: true });

        if (!editing && !hideInviteUsers) {
            steps.push({ key: "invite", labelKey: "invite.invite", valid: true });
        }
        return steps;
    }

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunity === undefined || client.canInviteUsers($selectedCommunity.id);
        return client.searchUsersForInvite(term, 20, candidateGroup.level, true, canInvite);
    }

    function groupUpdateErrorMessage(
        resp: UpdateGroupResponse,
        level: Level,
    ): ResourceKey | undefined {
        console.log("Group update response: ", resp);
        if (resp.kind === "success") return undefined;
        if (resp.kind === "unchanged") return undefined;
        if (resp.kind === "name_too_short") return i18nKey("groupNameTooShort");
        if (resp.kind === "name_too_long") return i18nKey("groupNameTooLong");
        if (resp.kind === "name_reserved") return i18nKey("groupNameReserved");
        if (resp.kind === "desc_too_long") return i18nKey("groupDescTooLong");
        if (resp.kind === "name_taken" && level === "group") return i18nKey("groupAlreadyExists");
        if (resp.kind === "name_taken") return i18nKey("channelAlreadyExists");
        if (resp.kind === "not_in_group") return i18nKey("userNotInGroup");
        if (resp.kind === "internal_error") return i18nKey("groupUpdateFailed");
        if (resp.kind === "not_authorized") return i18nKey("groupUpdateFailed");
        if (resp.kind === "avatar_too_big") return i18nKey("avatarTooBig");
        if (resp.kind === "rules_too_short") return i18nKey("groupRulesTooShort");
        if (resp.kind === "rules_too_long") return i18nKey("groupRulesTooLong");
        if (resp.kind === "user_suspended") return i18nKey("userSuspended");
        if (resp.kind === "user_lapsed") return i18nKey("userLapsed");
        if (resp.kind === "chat_frozen") return i18nKey("chatFrozen");
        if (resp.kind === "failure" || resp.kind === "error") return i18nKey("failure");
        if (resp.kind === "offline") return i18nKey("offlineError");
        if (resp.kind === "access_gate_invalid") return i18nKey("access.gateInvalid");
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
    }

    function groupCreationErrorMessage(
        resp: CreateGroupResponse,
        level: Level,
    ): ResourceKey | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "offline") return i18nKey("offlineError");
        if (resp.kind === "internal_error") return i18nKey("groupCreationFailed");
        if (resp.kind === "name_too_short") return i18nKey("groupNameTooShort");
        if (resp.kind === "name_too_long") return i18nKey("groupNameTooLong");
        if (resp.kind === "name_reserved") return i18nKey("groupNameReserved");
        if (resp.kind === "description_too_long") return i18nKey("groupDescTooLong");
        if (resp.kind === "group_name_taken" && level === "group")
            return i18nKey("groupAlreadyExists");
        if (resp.kind === "group_name_taken") return i18nKey("channelAlreadyExists");
        if (resp.kind === "avatar_too_big") return i18nKey("groupAvatarTooBig");
        if (resp.kind === "max_groups_created") return i18nKey("maxGroupsCreated");
        if (resp.kind === "throttled") return i18nKey("groupCreationFailed");
        if (resp.kind === "rules_too_short") return i18nKey("groupRulesTooShort");
        if (resp.kind === "rules_too_long") return i18nKey("groupRulesTooLong");
        if (resp.kind === "user_suspended") return i18nKey("userSuspended");
        if (resp.kind === "unauthorized_to_create_public_group")
            return i18nKey("unauthorizedToCreatePublicGroup");
        if (resp.kind === "access_gate_invalid") return i18nKey("access.gateInvalid");
        return i18nKey("groupCreationFailed");
    }

    function optionallyInviteUsers(chatId: MultiUserChatIdentifier): Promise<void> {
        if (candidateGroup.members.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                candidateGroup.members.map((m) => m.user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }

    function updateGroup(yes: boolean = true): Promise<void> {
        busy = true;

        const changeVisibility = visDirty && candidateGroup.public !== originalGroup.public;

        if (verificationWarning && !showingVerificationWarning) {
            showingVerificationWarning = true;
            return Promise.resolve();
        }

        if (changeVisibility && !confirming) {
            confirming = true;
            return Promise.resolve();
        }

        if (verificationWarning && showingVerificationWarning && !yes) {
            showingVerificationWarning = false;
            busy = false;
            candidateGroup.name = originalGroup.name;
            return Promise.resolve();
        }

        if (changeVisibility && confirming && !yes) {
            confirming = false;
            busy = false;
            return Promise.resolve();
        }

        confirming = false;

        const updatedGroup = $state.snapshot(candidateGroup);

        return client
            .updateGroup(
                updatedGroup.id,
                nameDirty ? updatedGroup.name : undefined,
                descDirty ? updatedGroup.description : undefined,
                rulesDirty && rulesValid ? updatedGroup.rules : undefined,
                permissionsDirty
                    ? client.diffGroupPermissions(
                          originalGroup.permissions,
                          updatedGroup.permissions,
                      )
                    : undefined,
                avatarDirty ? updatedGroup.avatar?.blobData : undefined,
                ttlDirty
                    ? updatedGroup.eventsTTL === undefined
                        ? "set_to_none"
                        : { value: updatedGroup.eventsTTL }
                    : undefined,
                gateDirty ? updatedGroup.gateConfig : undefined,
                visDirty ? updatedGroup.public : undefined,
                messagesVisibleToNonMembersDirty
                    ? updatedGroup.messagesVisibleToNonMembers
                    : undefined,
                externalUrlDirty ? updatedGroup.externalUrl : undefined,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    originalGroup = updatedGroup;
                } else {
                    const resourceKey = groupUpdateErrorMessage(resp, updatedGroup.level);
                    if (resourceKey) {
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level: updatedGroup.level,
                            lowercase: true,
                        });
                    }
                }
            })
            .finally(() => {
                busy = false;
                onClose();
            });
    }

    function createGroup() {
        busy = true;

        const level = candidateGroup.level;

        client
            .createGroupChat($state.snapshot(candidateGroup))
            .then((resp) => {
                if (resp.kind !== "success") {
                    const resourceKey = groupCreationErrorMessage(resp, level);
                    if (resourceKey)
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level,
                            lowercase: true,
                        });
                    step = "details";
                } else if (!hideInviteUsers) {
                    optionallyInviteUsers(resp.canisterId).catch((_err) => {
                        toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        step = "details";
                    });
                    onGroupCreated(resp.canisterId);
                } else {
                    onGroupCreated(resp.canisterId);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("groupCreationFailed"));
                console.error("Error creating group: ", err);
                step = "details";
            })
            .finally(() => (busy = false));
    }

    function onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier($chatListScope.kind, canisterId);
        onClose();
        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => page(url)); // trigger the selection of the chat
    }

    function changeStep(ev: CustomEvent<string>) {
        step = ev.detail;
    }
    let editing = $derived(!chatIdentifierUnset(candidateGroup.id));
    let hideInviteUsers = $derived(candidateGroup.level === "channel" && candidateGroup.public);
    let steps = $derived(
        getSteps(
            editing,
            detailsValid,
            visibilityValid,
            rulesValid,
            hideInviteUsers,
            embeddedContent,
        ),
    );
    let stepIndex = $derived(steps.findIndex((s) => s.key === step) ?? 0);
    let canEditPermissions = $derived(
        !editing ? true : client.canChangePermissions(candidateGroup.id),
    );
    let canEditDisappearingMessages = $derived(
        !editing ? true : client.hasOwnerRights(candidateGroup.membership.role),
    );
    let permissionsDirty = $derived(
        client.haveGroupPermissionsChanged(originalGroup.permissions, candidateGroup.permissions),
    );
    let rulesDirty = $derived(
        editing &&
            candidateGroup.rules !== undefined &&
            (candidateGroup.rules.enabled !== originalGroup.rules.enabled ||
                candidateGroup.rules.text !== originalGroup.rules.text),
    );
    let nameDirty = $derived(editing && candidateGroup.name !== originalGroup.name);
    let descDirty = $derived(editing && candidateGroup.description !== originalGroup.description);
    let externalUrlDirty = $derived(
        editing && candidateGroup.externalUrl !== originalGroup.externalUrl,
    );
    let avatarDirty = $derived(
        editing && candidateGroup.avatar?.blobUrl !== originalGroup.avatar?.blobUrl,
    );
    let visDirty = $derived(editing && candidateGroup.public !== originalGroup.public);
    let infoDirty = $derived(nameDirty || descDirty || avatarDirty || externalUrlDirty);
    let gateDirty = $derived(
        editing && client.hasAccessGateChanged(candidateGroup.gateConfig, originalGroup.gateConfig),
    );
    let ttlDirty = $derived(editing && candidateGroup.eventsTTL !== originalGroup.eventsTTL);
    let messagesVisibleToNonMembersDirty = $derived(
        editing &&
            candidateGroup.messagesVisibleToNonMembers !==
                originalGroup.messagesVisibleToNonMembers,
    );
    let dirty = $derived(
        infoDirty ||
            rulesDirty ||
            permissionsDirty ||
            visDirty ||
            gateDirty ||
            ttlDirty ||
            messagesVisibleToNonMembersDirty,
    );
    let valid = $derived(detailsValid && visibilityValid && rulesValid);
    $effect(() => {
        if (candidateGroup.public) {
            candidateGroup.permissions.startVideoCall = "admin";
        }
    });
    let verificationWarning = $derived(nameDirty && editing && originalGroup.verified);
</script>

{#if confirming}
    <AreYouSure
        message={i18nKey(
            `confirmMakeGroup${candidateGroup.public ? "Public" : "Private"}`,
            undefined,
            candidateGroup.level,
            true,
        )}
        action={updateGroup} />
{/if}

{#if showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, candidateGroup.level, true)}
        action={updateGroup} />
{/if}

<ModalContent bind:actualWidth closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable
                resourceKey={editing
                    ? i18nKey("group.edit", undefined, candidateGroup.level, true)
                    : i18nKey("group.createTitle", undefined, candidateGroup.level, true)} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <StageHeader {steps} enabled on:step={changeStep} {step} />
            <div class="wrapper">
                {#if step === "details"}
                    <div class="details">
                        <GroupDetails
                            {embeddedContent}
                            bind:valid={detailsValid}
                            {busy}
                            bind:candidateGroup />
                    </div>
                {/if}
                {#if step === "visibility"}
                    <div class="visibility">
                        <VisibilityControl
                            {embeddedContent}
                            on:upgrade={onUpgrade}
                            {editing}
                            history
                            {canEditDisappearingMessages}
                            bind:valid={visibilityValid}
                            bind:candidate={candidateGroup}
                            {gateDirty} />
                    </div>
                {/if}
                {#if !embeddedContent && step === "rules"}
                    <div class="rules">
                        <RulesEditor
                            bind:valid={rulesValid}
                            level={candidateGroup.level}
                            bind:rules={candidateGroup.rules}
                            {editing} />
                    </div>
                {/if}
                {#if step === "permissions"}
                    <div use:menuCloser class="permissions">
                        {#if canEditPermissions}
                            <GroupPermissionsEditor
                                {embeddedContent}
                                {editing}
                                bind:permissions={candidateGroup.permissions}
                                isPublic={candidateGroup.public}
                                isCommunityPublic={$selectedCommunity?.public ?? true}
                                isChannel={candidateGroup.id.kind === "channel"} />
                        {:else}
                            <GroupPermissionsViewer
                                {embeddedContent}
                                bind:permissions={candidateGroup.permissions}
                                isPublic={candidateGroup.public}
                                isCommunityPublic={$selectedCommunity?.public ?? true}
                                isChannel={candidateGroup.id.kind === "channel"} />
                        {/if}
                    </div>
                {/if}
                {#if !editing && !hideInviteUsers && step === "invite"}
                    <div class="members">
                        <ChooseMembers
                            userLookup={searchUsers}
                            bind:members={candidateGroup.members}
                            {busy} />
                    </div>
                {/if}
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <span class="footer">
            <div class="group-buttons">
                <div class="back">
                    {#if !editing && stepIndex > 0}
                        <Button
                            disabled={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={() => (step = steps[stepIndex - 1].key)}
                            ><Translatable resourceKey={i18nKey("group.back")} /></Button>
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        disabled={false}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={onClose}
                        secondary><Translatable resourceKey={i18nKey("cancel")} /></Button>

                    {#if editing}
                        <Button
                            disabled={!dirty || busy || !valid}
                            loading={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={() => updateGroup()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.update",
                                    undefined,
                                    candidateGroup.level,
                                    true,
                                )} /></Button>
                    {:else if stepIndex < steps.length - 1}
                        <Button
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={() => (step = steps[stepIndex + 1].key)}
                            ><Translatable resourceKey={i18nKey("group.next")} />
                        </Button>
                    {:else}
                        <Button
                            disabled={busy || !valid}
                            loading={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={createGroup}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.create",
                                    undefined,
                                    candidateGroup.level,
                                    true,
                                )} /></Button>
                    {/if}
                </div>
            </div>
        </span>
    {/snippet}
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
        height: 550px;
        display: flex;
        @include nice-scrollbar();
        overflow-y: scroll;
        scrollbar-gutter: stable;

        @include mobile() {
            height: 400px;
        }
    }

    .details,
    .visibility,
    .rules,
    .members,
    .permissions {
        width: 100%;
    }
</style>
