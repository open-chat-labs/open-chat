<script lang="ts">
    import { menuCloser } from "component-lib";
    import {
        mobileWidth,
        type CommunityIdentifier,
        type CommunitySummary,
        type DefaultChannel,
        type OpenChat,
        type Rules,
        type UserSummary,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../../i18n/i18n";
    import { toastStore } from "../../../../stores/toast";
    import AreYouSure from "../../../AreYouSure.svelte";
    import Button from "../../../Button.svelte";
    import ModalContent from "../../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { UpdateCommunityState } from "@src/logic/groupOrCommunity/community.svelte";
    import ChooseMembers from "../../ChooseMembers.svelte";
    import RulesEditor from "../../RulesEditor.svelte";
    import StageHeader from "../../StageHeader.svelte";
    import VisibilityControl from "../../VisibilityControl.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import ChooseChannels from "./ChooseChannels.svelte";
    import Details from "./Details.svelte";
    import PermissionsEditor from "./PermissionsEditor.svelte";

    interface Props {
        original: CommunitySummary;
        originalRules: Rules;
        onClose: () => void;
    }

    let { original, originalRules, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const ucs = new UpdateCommunityState();
    ucs.initialise(
        untrack(() => original),
        untrack(() => originalRules),
    );

    let actualWidth = $state(0);
    const editing = ucs.editMode;
    let step = $state("details");
    let channels: DefaultChannel[] = $state([
        { name: $_("communities.general"), createdAt: Date.now() },
    ]);
    let channelsValid = $state(true);
    let detailsValid = $state(true);
    let rulesValid = $state(true);
    let visibilityValid = $state(true);

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        visibilityValid: boolean,
        channelsValid: boolean,
        rulesValid: boolean,
    ) {
        const steps = [
            { key: "details", labelKey: "communities.details", valid: detailsValid },
            { key: "visibility", labelKey: "communities.visibility", valid: visibilityValid },
            { key: "rules", labelKey: "communities.rules", valid: rulesValid },
            { key: "permissions", labelKey: "permissions.permissions", valid: true },
        ];

        if (!editing) {
            steps.push({ key: "channels", labelKey: "communities.channels", valid: channelsValid });
            steps.push({ key: "invite", labelKey: "communities.invite", valid: true });
        }
        return steps;
    }

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, "community", !editing, true);
    }

    async function save(yes: boolean = true) {
        ucs.channelNames = channels.map((c) => c.name);
        const outcome = await ucs.saveCommunity(client, yes);
        switch (outcome.kind) {
            case "needs_confirmation":
            case "declined":
            case "invalid":
                break;
            case "success":
                toastStore.showSuccessToast(i18nKey("communities.saved"));
                onClose();
                break;
            case "unchanged":
                onClose();
                break;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                break;
            case "created_without_invites":
                toastStore.showFailureToast(outcome.message);
                openCreatedCommunity(outcome.id);
                break;
            case "created":
                toastStore.showSuccessToast(i18nKey("communities.created"));
                openCreatedCommunity(outcome.id);
                break;
            default:
                outcome satisfies never;
        }
    }

    function openCreatedCommunity(id: CommunityIdentifier) {
        onClose();
        navigate(`/community/${id.communityId}`);
    }

    let steps = $derived(
        getSteps(editing, detailsValid, visibilityValid, channelsValid, rulesValid),
    );
    let canEditPermissions = $derived(
        !editing || client.canChangeCommunityPermissions(ucs.candidate.id),
    );
    let gateDirty = $derived(ucs.accessGatesChanged());
    let stepIndex = $derived(steps.findIndex((s) => s.key === step) ?? 0);
    let valid = $derived(detailsValid && channelsValid && rulesValid && visibilityValid);
</script>

{#if ucs.confirming}
    <AreYouSure
        message={i18nKey("confirmMakeGroupPrivate", undefined, ucs.candidate.level, true)}
        action={save} />
{/if}

{#if ucs.showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, ucs.candidate.level, true)}
        action={save} />
{/if}

<ModalContent bind:actualWidth closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable
                resourceKey={i18nKey(editing ? "communities.edit" : "communities.create")} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <StageHeader {steps} enabled onStep={(s) => (step = s)} {step} />
            <div use:menuCloser class="wrapper">
                {#if step === "details"}
                    <div class="details">
                        <Details
                            bind:valid={detailsValid}
                            bind:busy={ucs.busy}
                            bind:candidate={ucs.candidateCommunity} />
                    </div>
                {/if}
                {#if step === "visibility"}
                    <div class="visibility">
                        <VisibilityControl
                            canEditDisappearingMessages={false}
                            bind:candidate={ucs.candidateCommunity}
                            bind:valid={visibilityValid}
                            {editing}
                            {gateDirty}
                            history={false} />
                    </div>
                {/if}
                {#if step === "rules"}
                    <div class="rules">
                        <RulesEditor
                            bind:valid={rulesValid}
                            level={ucs.candidate.level}
                            bind:rules={ucs.rules}
                            {editing} />
                    </div>
                {/if}
                {#if step === "permissions"}
                    <div class="permissions">
                        {#if canEditPermissions}
                            <PermissionsEditor bind:permissions={ucs.candidateCommunity.permissions} />
                        {:else}
                            <PermissionsViewer
                                isPublic={ucs.candidate.public}
                                permissions={ucs.candidate.permissions} />
                        {/if}
                    </div>
                {/if}
                {#if !editing}
                    {#if step === "channels"}
                        <div class="channels">
                            <ChooseChannels bind:valid={channelsValid} bind:channels />
                        </div>
                    {/if}
                    {#if step === "invite"}
                        <div class="members">
                            <ChooseMembers
                                userLookup={searchUsers}
                                bind:members={ucs.candidateMembers}
                                busy={ucs.busy} />
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <span class="footer">
            <div class="community-buttons">
                <div class="back">
                    {#if !editing && stepIndex > 0}
                        <Button
                            disabled={ucs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex - 1].key)}
                            ><Translatable resourceKey={i18nKey("communities.back")} /></Button>
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        disabled={false}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={onClose}
                        secondary><Translatable resourceKey={i18nKey("cancel")} /></Button>

                    {#if editing}
                        <Button
                            disabled={!ucs.hasChanges() || ucs.busy || !valid}
                            loading={ucs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => save()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.update",
                                    undefined,
                                    "community",
                                    true,
                                )} /></Button>
                    {:else if stepIndex < steps.length - 1}
                        <Button
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex + 1].key)}>
                            <Translatable resourceKey={i18nKey("communities.next")} />
                        </Button>
                    {:else}
                        <Button
                            disabled={ucs.busy || !valid}
                            loading={ucs.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => save()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.create",
                                    undefined,
                                    "community",
                                    true,
                                )} /></Button>
                    {/if}
                </div>
            </div>
        </span>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.community-buttons button:not(.loading)) {
        @include mobile() {
            min-width: 0 !important;
        }
    }

    :global(.community-buttons .actions button) {
        height: auto;
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .community-buttons {
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
        height: 600px;
        position: relative;
        display: flex;
        @include nice-scrollbar();

        @include mobile() {
            height: 400px;
        }
    }

    .details,
    .visibility,
    .rules,
    .members,
    .channels,
    .permissions {
        width: 100%;
    }
</style>
