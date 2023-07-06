<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Button from "../../../Button.svelte";
    import { menuCloser } from "../../../../actions/closeMenu";
    import ChooseMembers from "../../ChooseMembers.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type {
        AccessRules,
        CandidateMember,
        CommunitySummary,
        DefaultChannel,
        OpenChat,
    } from "openchat-client";
    import StageHeader from "../../StageHeader.svelte";
    import PermissionsEditor from "./PermissionsEditor.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import Rules from "../../Rules.svelte";
    import Details from "./Details.svelte";
    import { createCandidateCommunity } from "stores/community";
    import VisibilityControl from "../../VisibilityControl.svelte";
    import ChooseChannels from "./ChooseChannels.svelte";
    import { toastStore } from "stores/toast";
    import { interpolateLevel } from "../../../../utils/i18n";
    import page from "page";
    import AreYouSure from "../../../AreYouSure.svelte";

    export let original: CommunitySummary = createCandidateCommunity("");
    export let originalRules: AccessRules;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let actualWidth = 0;
    let editing = original.id.communityId !== "";
    let step = 0;
    let busy = false;
    let confirming = false;
    let candidate = original;
    let candidateRules = originalRules;
    let members: CandidateMember[] = [];
    let channels: DefaultChannel[] = [{ name: $_("communities.general"), createdAt: Date.now() }];
    let channelsValid = true;
    let detailsValid = true;
    let rulesValid = true;
    $: steps = getSteps(editing, detailsValid, channelsValid, rulesValid);
    $: canEditPermissions = !editing || client.canChangeCommunityPermissions(candidate.id);
    $: permissionsDirty = client.havePermissionsChanged(
        original.permissions,
        candidate.permissions
    );
    $: rulesDirty =
        editing &&
        (candidateRules.enabled !== originalRules.enabled ||
            candidateRules.text !== originalRules.text);
    $: nameDirty = editing && candidate.name !== original.name;
    $: descDirty = editing && candidate.description !== original.description;
    $: avatarDirty = editing && candidate.avatar?.blobUrl !== original.avatar?.blobUrl;
    $: bannerDirty = editing && candidate.banner.blobUrl !== original.banner.blobUrl;
    $: visDirty = editing && candidate.public !== original.public;
    $: infoDirty = nameDirty || descDirty || avatarDirty || bannerDirty;
    $: gateDirty = client.hasAccessGateChanged(candidate.gate, original.gate);
    $: dirty = infoDirty || rulesDirty || permissionsDirty || visDirty || gateDirty;
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: valid = detailsValid && channelsValid && rulesValid;

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        channelsValid: boolean,
        rulesValid: boolean
    ) {
        let steps = [
            { labelKey: "communities.details", valid: detailsValid },
            { labelKey: "communities.visibility", valid: true },
            { labelKey: "communities.rules", valid: rulesValid },
            { labelKey: "permissions.permissions", valid: true },
        ];

        if (!editing) {
            steps.push({ labelKey: "communities.channels", valid: channelsValid });
            steps.push({ labelKey: "communities.invite", valid: true });
        }
        return steps;
    }

    onMount(() => {
        candidate = {
            ...original,
            permissions: { ...original.permissions },
            gate: { ...original.gate },
        };
        candidateRules = {
            ...originalRules,
        };
    });

    function changeStep(ev: CustomEvent<number>) {
        step = ev.detail;
    }

    function save(yes: boolean = true): Promise<void> {
        busy = true;
        if (editing) {
            const makePrivate = visDirty && !candidate.public && original.public;

            if (makePrivate && !confirming) {
                confirming = true;
                return Promise.resolve();
            }

            if (makePrivate && confirming && !yes) {
                confirming = false;
                busy = false;
                candidate.public = true;
                return Promise.resolve();
            }

            confirming = false;

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
                    gateDirty ? candidate.gate : undefined,
                    candidate.public !== original.public ? candidate.public : undefined
                )
                .then((success: boolean) => {
                    if (success) {
                        toastStore.showSuccessToast("communities.saved");
                        dispatch("close");
                    } else {
                        toastStore.showFailureToast("communities.errors.saveFailed");
                    }
                })
                .finally(() => (busy = false));
        } else {
            return client
                .createCommunity(
                    candidate,
                    candidateRules,
                    channels.map((c) => c.name)
                )
                .then((response) => {
                    if (response.kind === "success") {
                        toastStore.showSuccessToast("communities.created");
                        dispatch("close");
                        page(`/community/${response.id}`);
                    } else {
                        toastStore.showFailureToast(`communities.errors.${response.kind}`);
                    }
                })
                .finally(() => (busy = false));
        }
    }
</script>

{#if confirming}
    <AreYouSure
        message={interpolateLevel("confirmMakeGroupPrivate", candidate.level, true)}
        action={save} />
{/if}

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">
        {editing ? $_("communities.edit") : $_("communities.create")}
    </div>
    <div class="body" slot="body">
        <StageHeader {steps} enabled={true} on:step={changeStep} {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details" class:visible={step === 0}>
                    <Details bind:valid={detailsValid} bind:busy bind:candidate />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <VisibilityControl bind:candidate {original} {editing} history={false} />
                </div>
                <div class="rules" class:visible={step === 2}>
                    <Rules
                        bind:valid={rulesValid}
                        level={candidate.level}
                        bind:rules={candidateRules} />
                </div>
                <div use:menuCloser class="permissions" class:visible={step === 3}>
                    {#if canEditPermissions}
                        <PermissionsEditor bind:permissions={candidate.permissions} />
                    {:else}
                        <PermissionsViewer permissions={candidate.permissions} />
                    {/if}
                </div>
                {#if !editing}
                    <div class="channels" class:visible={step === 4}>
                        <ChooseChannels bind:valid={channelsValid} bind:channels />
                    </div>
                    <div class="members" class:visible={step === 5}>
                        <ChooseMembers bind:members {busy} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <div class="community-buttons">
            <div class="back">
                {#if !editing && step > 0}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step - 1)}>{$_("communities.back")}</Button>
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
                        on:click={() => save()}
                        >{interpolateLevel("group.update", "community", true)}</Button>
                {:else if step < steps.length - 1}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step + 1)}>
                        {$_("communities.next")}
                    </Button>
                {:else}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => save()}
                        >{interpolateLevel("group.create", "community", true)}</Button>
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
    .channels,
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
