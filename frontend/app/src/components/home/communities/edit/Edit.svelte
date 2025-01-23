<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Button from "../../../Button.svelte";
    import { menuCloser } from "../../../../actions/closeMenu";
    import ChooseMembers from "../../ChooseMembers.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { createEventDispatcher, getContext, onMount } from "svelte";
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

    export let original: CommunitySummary = createCandidateCommunity("", 0);
    export let originalRules: Rules;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let actualWidth = 0;
    let editing = original.id.communityId !== "";
    let step = "details";
    let busy = false;
    let confirming = false;
    let showingVerificationWarning = false;
    let candidate = structuredClone(original);
    let candidateRules = { ...originalRules, newVersion: false };
    let members: CandidateMember[] = [];
    let channels: DefaultChannel[] = [{ name: $_("communities.general"), createdAt: Date.now() }];
    let channelsValid = true;
    let detailsValid = true;
    let rulesValid = true;
    let visibilityValid = true;
    $: steps = getSteps(editing, detailsValid, visibilityValid, channelsValid, rulesValid);
    $: canEditPermissions = !editing || client.canChangeCommunityPermissions(candidate.id);
    $: permissionsDirty = client.haveCommunityPermissionsChanged(
        original.permissions,
        candidate.permissions,
    );
    $: rulesDirty =
        editing &&
        (candidateRules.enabled !== originalRules.enabled ||
            candidateRules.text !== originalRules.text);
    $: nameDirty = editing && candidate.name !== original.name;
    $: descDirty = editing && candidate.description !== original.description;
    $: languageDirty = editing && candidate.primaryLanguage !== original.primaryLanguage;
    $: avatarDirty = editing && candidate.avatar?.blobUrl !== original.avatar?.blobUrl;
    $: bannerDirty = editing && candidate.banner.blobUrl !== original.banner.blobUrl;
    $: visDirty = editing && candidate.public !== original.public;
    $: infoDirty = nameDirty || descDirty || avatarDirty || bannerDirty || languageDirty;
    $: gateDirty = client.hasAccessGateChanged(candidate.gateConfig, original.gateConfig);
    $: dirty = infoDirty || rulesDirty || permissionsDirty || visDirty || gateDirty;
    $: stepIndex = steps.findIndex((s) => s.key === step) ?? 0;
    $: valid = detailsValid && channelsValid && rulesValid && visibilityValid;
    $: verificationWarning = nameDirty && editing && original.verified;

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

            return client
                .saveCommunity(
                    candidate,
                    candidate.name !== original.name ? candidate.name : undefined,
                    candidate.description !== original.description
                        ? candidate.description
                        : undefined,
                    rulesDirty ? candidateRules : undefined,
                    permissionsDirty ? candidate.permissions : undefined,
                    avatarDirty ? candidate.avatar.blobData : undefined,
                    bannerDirty ? candidate.banner.blobData : undefined,
                    gateDirty ? candidate.gateConfig : undefined,
                    candidate.public !== original.public ? candidate.public : undefined,
                    languageDirty ? candidate.primaryLanguage : undefined,
                )
                .then((success: boolean) => {
                    if (success) {
                        toastStore.showSuccessToast(i18nKey("communities.saved"));
                        dispatch("close");
                    } else {
                        toastStore.showFailureToast(i18nKey("communities.errors.saveFailed"));
                    }
                })
                .finally(() => (busy = false));
        } else {
            return client
                .createCommunity(
                    candidate,
                    candidateRules,
                    channels.map((c) => c.name),
                )
                .then((response) => {
                    if (response.kind === "success") {
                        toastStore.showSuccessToast(i18nKey("communities.created"));
                        dispatch("close");
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

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey(editing ? "communities.edit" : "communities.create")} />
    </div>
    <div class="body" slot="body">
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
    <span class="footer" slot="footer">
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
                    on:click={() => dispatch("close")}
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
