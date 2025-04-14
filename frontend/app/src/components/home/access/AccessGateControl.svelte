<script lang="ts">
    import { ui, type AccessGateConfig, type Level } from "openchat-client";
    import { _ } from "svelte-i18n";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import { fade } from "svelte/transition";
    import { i18nKey } from "../../../i18n/i18n";
    import AlertBox from "../../AlertBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateSummary from "./AccessGateSummary.svelte";

    interface Props {
        gateConfig: AccessGateConfig;
        level: Level;
        valid: boolean;
        onUpdated: () => void;
    }

    let { gateConfig = $bindable(), level, valid = $bindable(), onUpdated }: Props = $props();
</script>

<div in:fade={{ duration: 250 }} class="wrapper">
    <div class="icon">
        <LockOutline size={ui.iconSize} color={"var(--icon-txt)"} />
    </div>
    <div class="section">
        <div class="section-title">{$_("access.chooseGate")}</div>
        <div class="choose-gate">
            <AccessGateSummary
                {onUpdated}
                showNoGate={true}
                bind:valid
                {level}
                editable
                bind:gateConfig />
        </div>
        {#if gateConfig.gate.kind !== "no_gate"}
            <AlertBox>
                <Translatable
                    resourceKey={i18nKey("access.bypassWarning", undefined, level, true)} />
            </AlertBox>
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
        margin-bottom: $sp4;
    }

    .choose-gate {
        margin-bottom: $sp4;
    }
</style>
