<script lang="ts">
    import { _ } from "svelte-i18n";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { fade } from "svelte/transition";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import type { AccessGate, Level } from "openchat-client";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let gate: AccessGate;
    export let level: Level;
    export let valid: boolean;
</script>

<div transition:fade|local={{ duration: 250 }} class="wrapper">
    <div class="icon">
        <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
    <div class="section">
        <div class="section-title">{$_("access.chooseGate")}</div>
        <div class="choose-gate">
            <AccessGateSummary on:updated showNoGate={true} bind:valid {level} editable bind:gate />
        </div>
        {#if gate.kind !== "no_gate"}
            <ErrorMessage>
                <Translatable
                    resourceKey={i18nKey("access.bypassWarning", undefined, level, true)} />
            </ErrorMessage>
        {/if}
    </div>
</div>

<style lang="scss">
    .wrapper {
        display: flex;
        align-items: flex-start;
        max-width: 85%;

        .icon {
            flex: 0 0 toRem(34);
        }

        .section-title {
            margin-bottom: $sp3;
        }

        .section {
            flex: auto;
        }

        @include mobile() {
            max-width: unset;
        }
    }

    .section {
        margin-bottom: $sp6;
    }

    .choose-gate {
        margin-bottom: $sp4;
    }
</style>
