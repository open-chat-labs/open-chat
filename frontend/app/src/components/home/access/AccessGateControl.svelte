<script lang="ts">
    import { _ } from "svelte-i18n";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { fade } from "svelte/transition";
    import AccessGateSummary from "./AccessGateSummary.svelte";
    import type { AccessGateConfig, Level } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import AlertBox from "../../AlertBox.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import DurationPicker from "../DurationPicker.svelte";

    export let gateConfig: AccessGateConfig;
    export let level: Level;
    export let valid: boolean;

    let gateValid = true;
    let evaluationIntervalValid: boolean;

    $: {
        valid = gateValid && (gateConfig.expiry !== undefined ? evaluationIntervalValid : true);
    }

    function toggleEvaluationInterval() {
        if (gateConfig.expiry === undefined) {
            gateConfig.expiry = BigInt(1000 * 60 * 60 * 24 * 7 * 4 * 3); // default this to three months
        } else {
            gateConfig.expiry = undefined;
        }
    }
</script>

<div transition:fade|local={{ duration: 250 }} class="wrapper">
    <div class="icon">
        <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
    <div class="section">
        <div class="section-title">{$_("access.chooseGate")}</div>
        <div class="choose-gate">
            <AccessGateSummary
                on:updated
                showNoGate={true}
                bind:valid={gateValid}
                {level}
                editable
                bind:gate={gateConfig.gate} />
        </div>
        {#if gateConfig.gate.kind !== "no_gate"}
            <AlertBox>
                <Translatable
                    resourceKey={i18nKey("access.bypassWarning", undefined, level, true)} />
            </AlertBox>
        {/if}
    </div>
</div>

{#if gateConfig.gate.kind !== "no_gate"}
    <div class="section">
        <Checkbox
            id="evaluation-interval"
            on:change={toggleEvaluationInterval}
            label={i18nKey("access.evaluationInterval")}
            align={"start"}
            checked={gateConfig.expiry !== undefined}>
            <div class="section-title disappear">
                <Translatable resourceKey={i18nKey("access.evaluationInterval")} />
            </div>
            <div class="info">
                <Translatable resourceKey={i18nKey("access.evaluationIntervalInfo")} />
            </div>
            <div class="info">
                {#if gateConfig.expiry !== undefined}
                    <!-- <DurationPicker
                        bind:valid={evaluationIntervalValid}
                        bind:milliseconds={gateConfig.expiry}
                        unitFilter={(u) => !["minutes", "hours"].includes(u)} /> -->
                    <DurationPicker
                        bind:valid={evaluationIntervalValid}
                        bind:milliseconds={gateConfig.expiry} />
                {/if}
            </div>
        </Checkbox>
    </div>
{/if}

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
        margin-bottom: $sp4;
    }

    .choose-gate {
        margin-bottom: $sp4;
    }
    .info {
        @include font(book, normal, fs-80, 22);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
</style>
