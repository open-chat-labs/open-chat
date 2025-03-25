<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Button from "../../../Button.svelte";
    import { menuCloser } from "../../../../actions/closeMenu";
    import ChooseMembers from "../../ChooseMembers.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { getContext, onMount } from "svelte";
    import type {
        CandidateMember,
        CommunitySummary,
        DefaultChannel,
        OpenChat,
        Rules,
        UserSummary,
    } from "openchat-client";
    import StageHeader from "../../StageHeader.svelte";
    import PermissionsEditor from "./PermissionsEditor.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import RulesEditor from "../../RulesEditor.svelte";
    import Details from "./Details.svelte";
    import { createCandidateCommunity } from "../../../../stores/community";
    import VisibilityControl from "../../VisibilityControl.svelte";
    import ChooseChannels from "./ChooseChannels.svelte";
    import { toastStore } from "../../../../stores/toast";
    import page from "page";
    import AreYouSure from "../../../AreYouSure.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";

    interface Props {
        original?: CommunitySummary;
        originalRules: Rules;
        onClose: () => void;
    }

    let { original = createCandidateCommunity("", 0), originalRules, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let actualWidth = $state(0);
    let editing = original.id.communityId !== "";
    let step = $state("details");
    let busy = $state(false);
    let confirming = $state(false);
    let showingVerificationWarning = $state(false);
    let candidate = $state(structuredClone(original));
    let candidateRules = $state({ ...originalRules, newVersion: false });
    let members: CandidateMember[] = $state([]);
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
        let steps = [
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

    onMount(() => {
        candidate = {
            ...original,
            permissions: { ...original.permissions },
            gateConfig: {
                gate: { ...original.gateConfig.gate },
                expiry: original.gateConfig.expiry,
            },
        };
        candidateRules = { ...originalRules, newVersion: false };
    });

    function changeStep(ev: CustomEvent<string>) {
        step = ev.detail;
    }

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, "community", !editing, true);
    }

    function optionallyInviteUsers(communityId: string): Promise<void> {
        if (members.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                { kind: "community", communityId },
                members.map((m) => m.user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new community");
                }
            });
    }

    function save(yes: boolean = true): Promise<void> {
        busy = true;
        if (editing) {
            const makePrivate = visDirty && !candidate.public && original.public;

            if (verificationWarning && !showingVerificationWarning) {
                showingVerificationWarning = true;
                return Promise.resolve();
            }

            if (makePrivate && !confirming) {
                confirming = true;
                return Promise.resolve();
            }

            if (verificationWarning && showingVerificationWarning && !yes) {
                showingVerificationWarning = false;
                busy = false;
                candidate.name = original.name;
                return Promise.resolve();
            }

            if (makePrivate && confirming && !yes) {
                confirming = false;
                busy = false;
                candidate.public = true;
                return Promise.resolve();
            }

            confirming = false;
            showingVerificationWarning = false;

            const community = $state.snapshot(candidate);
            const communityRules = $state.snapshot(candidateRules);
            return client
                .saveCommunity(
                    community,
                    community.name !== original.name ? community.name : undefined,
                    community.description !== original.description
                        ? community.description
                        : undefined,
                    rulesDirty ? communityRules : undefined,
                    permissionsDirty ? community.permissions : undefined,
                    avatarDirty ? community.avatar.blobData : undefined,
                    bannerDirty ? community.banner.blobData : undefined,
                    gateDirty ? community.gateConfig : undefined,
                    community.public !== original.public ? community.public : undefined,
                    languageDirty ? community.primaryLanguage : undefined,
                )
                .then((success: boolean) => {
                    if (success) {
                        toastStore.showSuccessToast(i18nKey("communities.saved"));
                        onClose();
                    } else {
                        toastStore.showFailureToast(i18nKey("communities.errors.saveFailed"));
                    }
                })
                .finally(() => (busy = false));
        } else {
            const community = $state.snapshot(candidate);
            const communityRules = $state.snapshot(candidateRules);
            return client
                .createCommunity(
                    community,
                    communityRules,
                    channels.map((c) => c.name),
                )
                .then((response) => {
                    if (response.kind === "success") {
                        toastStore.showSuccessToast(i18nKey("communities.created"));
                        onClose();
                        page(`/community/${response.id}`);
                        optionallyInviteUsers(response.id).catch((_err) => {
                            toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        });
                    } else {
                        toastStore.showFailureToast(i18nKey(`communities.errors.${response.kind}`));
                    }
                })
                .finally(() => (busy = false));
        }
    }
    let steps = $derived(
        getSteps(editing, detailsValid, visibilityValid, channelsValid, rulesValid),
    );
    let canEditPermissions = $derived(
        !editing || client.canChangeCommunityPermissions(candidate.id),
    );
    let permissionsDirty = $derived(
        client.haveCommunityPermissionsChanged(original.permissions, candidate.permissions),
    );
    let rulesDirty = $derived(
        editing &&
            (candidateRules.enabled !== originalRules.enabled ||
                candidateRules.text !== originalRules.text),
    );
    let nameDirty = $derived(editing && candidate.name !== original.name);
    let descDirty = $derived(editing && candidate.description !== original.description);
    let languageDirty = $derived(editing && candidate.primaryLanguage !== original.primaryLanguage);
    let avatarDirty = $derived(editing && candidate.avatar?.blobUrl !== original.avatar?.blobUrl);
    let bannerDirty = $derived(editing && candidate.banner.blobUrl !== original.banner.blobUrl);
    let visDirty = $derived(editing && candidate.public !== original.public);
    let infoDirty = $derived(nameDirty || descDirty || avatarDirty || bannerDirty || languageDirty);
    let gateDirty = $derived(
        client.hasAccessGateChanged(candidate.gateConfig, original.gateConfig),
    );
    let dirty = $derived(infoDirty || rulesDirty || permissionsDirty || visDirty || gateDirty);
    let stepIndex = $derived(steps.findIndex((s) => s.key === step) ?? 0);
    let valid = $derived(detailsValid && channelsValid && rulesValid && visibilityValid);
    let verificationWarning = $derived(nameDirty && editing && original.verified);
</script>

{#if confirming}
    <AreYouSure
        message={i18nKey("confirmMakeGroupPrivate", undefined, candidate.level, true)}
        action={save} />
{/if}

{#if showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, candidate.level, true)}
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
            <StageHeader {steps} enabled on:step={changeStep} {step} />
            <div class="wrapper">
                {#if step === "details"}
                    <div class="details">
                        <Details bind:valid={detailsValid} bind:busy bind:candidate />
                    </div>
                {/if}
                {#if step === "visibility"}
                    <div class="visibility">
                        <VisibilityControl
                            canEditDisappearingMessages={false}
                            bind:candidate
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
                            level={candidate.level}
                            bind:rules={candidateRules}
                            {editing} />
                    </div>
                {/if}
                {#if step === "permissions"}
                    <div use:menuCloser class="permissions">
                        {#if canEditPermissions}
                            <PermissionsEditor bind:permissions={candidate.permissions} />
                        {:else}
                            <PermissionsViewer
                                isPublic={candidate.public}
                                permissions={candidate.permissions} />
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
                            <ChooseMembers userLookup={searchUsers} bind:members {busy} />
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
                            disabled={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={() => (step = steps[stepIndex - 1].key)}
                            ><Translatable resourceKey={i18nKey("communities.back")} /></Button>
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
                            on:click={() => save()}
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
                            on:click={() => (step = steps[stepIndex + 1].key)}>
                            <Translatable resourceKey={i18nKey("communities.next")} />
                        </Button>
                    {:else}
                        <Button
                            disabled={busy || !valid}
                            loading={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            on:click={() => save()}
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
