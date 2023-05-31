<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type { Community, OpenChat } from "openchat-client";
    import StageHeader from "../../StageHeader.svelte";
    import PermissionsEditor from "./PermissionsEditor.svelte";
    import PermissionsViewer from "./PermissionsViewer.svelte";
    import Details from "./Details.svelte";
    import { dummyCommunities, createCandidateCommunity } from "stores/community";

    export let original: Community = createCandidateCommunity("");

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    let actualWidth = 0;
    let editing = original.id !== "";
    let step = 0;
    let busy = false;
    let candidate = original;
    const steps = [
        "communities.details",
        "communities.visibility",
        "communities.rules",
        "permissions.permissions",
    ];

    $: canEditPermissions = true; // TODO - this is a whole can of refactor worms which I don't want to open yet
    $: permissionsDirty = client.havePermissionsChanged(
        original.permissions,
        candidate.permissions
    );
    // $: rulesDirty =
    //     editing &&
    //     candidate.rules !== undefined &&
    //     (candidate.rules.enabled !== candidate.rules.enabled ||
    //         candidate.rules.text !== candidate.rules.text);
    // $: rulesInvalid =
    //     candidate.rules !== undefined &&
    //     candidate.rules.enabled &&
    //     candidate.rules.text.length === 0;
    $: nameDirty = editing && candidate.name !== original.name;
    $: descDirty = editing && candidate.description !== original.description;
    $: avatarDirty = editing && candidate.avatar?.blobUrl !== original.avatar?.blobUrl;
    $: bannerDirty = editing && candidate.banner.blobUrl !== original.banner.blobUrl;
    $: visDirty = editing && candidate.isPublic !== original.isPublic;
    $: infoDirty = nameDirty || descDirty || avatarDirty || bannerDirty;
    $: gateDirty = client.hasAccessGateChanged(candidate.gate, original.gate);
    $: dirty = infoDirty /*|| rulesDirty */ || permissionsDirty || visDirty || gateDirty;
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);

    onMount(() => {
        console.log("Cloning input community");
        candidate = { ...original };
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
                    <Details bind:busy {candidate} />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <h1>Visibility</h1>
                </div>
                <div class="rules" class:visible={step === 2}>
                    <h1>Rules</h1>
                </div>
                <div class="permissions" class:visible={step === 3}>
                    {#if canEditPermissions}
                        <PermissionsEditor permissions={candidate.permissions} />
                    {:else}
                        <PermissionsViewer permissions={candidate.permissions} />
                    {/if}
                </div>
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

<style type="text/scss">
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
