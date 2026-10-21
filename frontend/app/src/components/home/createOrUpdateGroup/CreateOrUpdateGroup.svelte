<script lang="ts">
    import { menuCloser } from "component-lib";
    import {
        type CandidateGroupChat,
        chatListScopeStore,
        mobileWidth,
        type MultiUserChatIdentifier,
        type OpenChat,
        ROLE_ADMIN,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        type UserSummary,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext, tick, untrack } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import AreYouSure from "../../AreYouSure.svelte";
    import Button from "../../Button.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
    import ChooseMembers from "../ChooseMembers.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import RulesEditor from "../RulesEditor.svelte";
    import StageHeader from "../StageHeader.svelte";
    import VisibilityControl from "../VisibilityControl.svelte";
    import GroupDetails from "./GroupDetails.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup: CandidateGroupChat;
        embeddedContent: boolean;
        onClose: () => void;
    }

    let { candidateGroup, embeddedContent, onClose }: Props = $props();

    // The modal is opened for one group
    const ugs = new UpdateGroupState();
    ugs.initialise(untrack(() => candidateGroup));

    let step = $state("details");
    let actualWidth = $state(0);
    let detailsValid = $state(true);
    let visibilityValid = $state(true);
    let rulesValid = $state(true);

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        visibilityValid: boolean,
        rulesValid: boolean,
        hideInviteUsers: boolean,
        embeddedContent: boolean,
    ) {
        const steps = [
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
            $selectedCommunitySummaryStore === undefined ||
            client.canInviteUsers($selectedCommunitySummaryStore.id);
        return client.searchUsersForInvite(term, 20, ugs.candidate.level, true, canInvite);
    }

    async function save(yes: boolean = true) {
        const outcome = await ugs.saveGroup(client, yes);
        switch (outcome.kind) {
            case "needs_confirmation":
            case "declined":
            case "invalid":
                break;
            case "success":
            case "unchanged":
                onClose();
                break;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                if (editing) {
                    onClose();
                } else {
                    step = "details";
                }
                break;
            case "created_without_invites":
                toastStore.showFailureToast(outcome.message);
                openCreatedGroup(outcome.chatId);
                break;
            case "created":
                openCreatedGroup(outcome.chatId);
                break;
            default:
                outcome satisfies never;
        }
    }

    function openCreatedGroup(chatId: MultiUserChatIdentifier) {
        onClose();
        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId)));
    }

    let editing = $derived(ugs.editMode);
    let steps = $derived(
        getSteps(
            editing,
            detailsValid,
            visibilityValid,
            rulesValid,
            ugs.hideInviteUsers,
            embeddedContent,
        ),
    );
    let stepIndex = $derived(steps.findIndex((s) => s.key === step) ?? 0);
    let canEditPermissions = $derived(
        !editing ? true : client.canChangePermissions(ugs.candidate.id),
    );
    let canEditDisappearingMessages = $derived(
        !editing ? true : client.hasOwnerRights(ugs.candidate.membership.role),
    );
    let gateDirty = $derived(editing && ugs.accessGatesChanged());
    let dirty = $derived(editing && ugs.hasChanges());
    let valid = $derived(detailsValid && visibilityValid && rulesValid);
    $effect(() => {
        if (ugs.candidate.public) {
            ugs.candidate.permissions.startVideoCall = ROLE_ADMIN;
        }
    });
</script>

{#if ugs.confirming}
    <AreYouSure
        message={i18nKey(
            `confirmMakeGroup${ugs.candidate.public ? "Public" : "Private"}`,
            undefined,
            ugs.candidate.level,
            true,
        )}
        action={save}
    />
{/if}

{#if ugs.showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, ugs.candidate.level, true)}
        action={save}
    />
{/if}

<ModalContent bind:actualWidth closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable
                resourceKey={editing
                    ? i18nKey("group.edit", undefined, ugs.candidate.level, true)
                    : i18nKey("group.createTitle", undefined, ugs.candidate.level, true)}
            />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <StageHeader {steps} enabled onStep={(s) => (step = s)} {step} />
            <div use:menuCloser class="wrapper">
                {#if step === "details"}
                    <div class="details">
                        <GroupDetails
                            {embeddedContent}
                            bind:valid={detailsValid}
                            busy={ugs.busy}
                            bind:candidateGroup={ugs.candidateGroup}
                        />
                    </div>
                {/if}
                {#if step === "visibility"}
                    <div class="visibility">
                        <VisibilityControl
                            {embeddedContent}
                            {editing}
                            history
                            {canEditDisappearingMessages}
                            bind:valid={visibilityValid}
                            bind:candidate={ugs.candidateGroup}
                            {gateDirty}
                        />
                    </div>
                {/if}
                {#if !embeddedContent && step === "rules"}
                    <div class="rules">
                        <RulesEditor
                            bind:valid={rulesValid}
                            level={ugs.candidate.level}
                            bind:rules={ugs.candidateGroup.rules}
                            {editing}
                        />
                    </div>
                {/if}
                {#if step === "permissions"}
                    <div class="permissions">
                        {#if canEditPermissions}
                            <GroupPermissionsEditor
                                {embeddedContent}
                                {editing}
                                bind:permissions={ugs.candidateGroup.permissions}
                                isPublic={ugs.candidate.public}
                                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                                isChannel={ugs.candidate.id.kind === "channel"}
                            />
                        {:else}
                            <GroupPermissionsViewer
                                {embeddedContent}
                                permissions={ugs.candidate.permissions}
                                isPublic={ugs.candidate.public}
                                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                                isChannel={ugs.candidate.id.kind === "channel"}
                            />
                        {/if}
                    </div>
                {/if}
                {#if !editing && !ugs.hideInviteUsers && step === "invite"}
                    <div class="members">
                        <ChooseMembers
                            userLookup={searchUsers}
                            bind:members={ugs.candidateMembers}
                            busy={ugs.busy}
                        />
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
                            disabled={ugs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex - 1].key)}
                            ><Translatable resourceKey={i18nKey("group.back")} /></Button
                        >
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        disabled={false}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={onClose}
                        secondary><Translatable resourceKey={i18nKey("cancel")} /></Button
                    >

                    {#if editing}
                        <Button
                            disabled={!dirty || ugs.busy || !valid}
                            loading={ugs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => save()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.update",
                                    undefined,
                                    ugs.candidate.level,
                                    true,
                                )}
                            /></Button
                        >
                    {:else if stepIndex < steps.length - 1}
                        <Button
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex + 1].key)}
                            ><Translatable resourceKey={i18nKey("group.next")} />
                        </Button>
                    {:else}
                        <Button
                            disabled={ugs.busy || !valid}
                            loading={ugs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => save()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.create",
                                    undefined,
                                    ugs.candidate.level,
                                    true,
                                )}
                            /></Button
                        >
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
