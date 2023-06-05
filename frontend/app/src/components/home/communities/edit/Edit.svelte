<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { menuCloser } from "../../../../actions/closeMenu";
    import ChooseMembers from "../../ChooseMembers.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type {
        AccessRules,
        CandidateMember,
        Community,
        DefaultChannel,
        OpenChat,
    } from "openchat-client";
    import StageHeader from "../../StageHeader.svelte";
    import PermissionsEditor from "./PermissionsEditor.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import Rules from "../../Rules.svelte";
    import Details from "./Details.svelte";
    import { dummyCommunities, createCandidateCommunity } from "stores/community";
    import VisibilityControl from "../../VisibilityControl.svelte";
    import ChooseChannels from "./ChooseChannels.svelte";

    export let original: Community = createCandidateCommunity("");

    //TODO - at the moment we are *always* passing in the default access rules even in the edit case because we don't know where to get the rules from yet
    export let originalRules: AccessRules;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    let actualWidth = 0;
    let editing = original.id !== "";
    let step = 0;
    let busy = false;
    let candidate = original;
    let candidateRules = originalRules;
    let members: CandidateMember[] = [];
    let channels: DefaultChannel[] = [{ name: $_("communities.general"), createdAt: Date.now() }];
    let channelsValid = true;
    let detailsValid = true;
    $: steps = getSteps(editing, detailsValid, channelsValid);
    $: canEditPermissions = true; // TODO - this is a whole can of refactor worms which I don't want to open yet
    $: permissionsDirty = client.havePermissionsChanged(
        original.permissions,
        candidate.permissions
    );
    $: rulesDirty =
        editing &&
        (candidateRules.enabled !== originalRules.enabled ||
            candidateRules.text !== originalRules.text);
    $: rulesInvalid = candidateRules.enabled && candidateRules.text.length === 0;
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

    function getSteps(editing: boolean, detailsValid: boolean, channelsValid: boolean) {
        let steps = [
            { labelKey: "communities.details", valid: detailsValid },
            { labelKey: "communities.visibility", valid: true },
            { labelKey: "communities.rules", valid: true },
            { labelKey: "permissions.permissions", valid: true },
        ];

        if (!editing) {
            steps.push({ labelKey: "communities.channels", valid: channelsValid });
            steps.push({ labelKey: "communities.invite", valid: true });
        }
        return steps;
    }

    onMount(() => {
        console.log("Cloning input community");
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

    function save() {
        // TODO this is a dummy save for now
        dummyCommunities.update((communities) => {
            if (editing) {
                return communities.map((c) => (c.id === candidate.id ? candidate : c));
            } else {
                const next = (communities.length + 2).toString();
                return [{ ...candidate, id: next }, ...communities];
            }
        });
    }
</script>

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">
        {editing ? $_("communities.edit") : $_("communities.create")}
    </div>
    <div class="body" slot="body">
        <StageHeader {steps} enabled={true} on:step={changeStep} {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details" class:visible={step === 0}>
                    <Details bind:valid={detailsValid} bind:busy {candidate} />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <VisibilityControl {candidate} {original} {editing} />
                </div>
                <div class="rules" class:visible={step === 2}>
                    <Rules level={candidate.level} bind:rules={candidateRules} />
                </div>
                <div use:menuCloser class="permissions" class:visible={step === 3}>
                    {#if canEditPermissions}
                        <PermissionsEditor permissions={candidate.permissions} />
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
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={save}
                        >{"(Dummy) Save"}</Button>
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step + 1)}>{$_("communities.next")}</Button>
                </ButtonGroup>
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
