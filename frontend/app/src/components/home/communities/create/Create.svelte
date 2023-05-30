<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../../ModalContent.svelte";
    import Overlay from "../../../Overlay.svelte";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import type { Community, OpenChat } from "openchat-client";
    import StageHeader from "./StageHeader.svelte";
    import Details from "./Details.svelte";

    export let show = false;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    let actualWidth = 0;
    let editing = false;
    let step = 0;
    let busy = false;
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: dirty = false;

    const candidate: Community = {
        id: "",
        name: "",
        description: "",
        memberCount: 0,
        channelCount: 0,
        unreadCount: 0,
        avatar: {},
        banner: {},
    };

    function changeStep(ev: CustomEvent<number>) {
        step = ev.detail;
    }
</script>

{#if show}
    <Overlay dismissible on:close={() => (show = false)}>
        <ModalContent bind:actualWidth closeIcon on:close={() => (show = false)}>
            <div class="header" slot="header">
                {editing ? $_("communities.edit") : $_("communities.create")}
            </div>
            <div class="body" slot="body">
                <StageHeader enabled={true} on:step={changeStep} {step} />
                <div class="wrapper">
                    <div class="sections" style={`left: -${left}px`}>
                        <div class="details" class:visible={step === 0}>
                            <Details bind:busy community={candidate} />
                        </div>
                        <div class="visibility" class:visible={step === 1}>
                            <h1>Visibility</h1>
                        </div>
                        <div class="rules" class:visible={step === 2}>
                            <h1>Rules</h1>
                        </div>
                        <div class="permissions" class:visible={step === 3}>
                            <h1>Permissions</h1>
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
                            <Button
                                small={!$mobileWidth}
                                tiny={$mobileWidth}
                                on:click={() => (step = step + 1)}>{$_("communities.next")}</Button>
                        </ButtonGroup>
                    </div>
                </div>
            </span>
        </ModalContent>
    </Overlay>
{/if}

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
