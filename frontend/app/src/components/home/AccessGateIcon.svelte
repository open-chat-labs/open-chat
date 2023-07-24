<script lang="ts">
    import { _ } from "svelte-i18n";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import { E8S_PER_TOKEN, AccessGate, isSnsGate } from "openchat-client";
    import { createEventDispatcher } from "svelte";
    import type { Alignment, Position } from "../../utils/alignment";
    import { snsGateBindings } from "utils/access";

    export let gate: AccessGate;
    export let position: Position = "top";
    export let align: Alignment = "start";
    export let small = false;

    const dispatch = createEventDispatcher();

    $: params = formatParams(gate);

    function formatParams(gate: AccessGate): string {
        const parts = [];
        if (isSnsGate(gate)) {
            if (gate.minDissolveDelay) {
                parts.push(
                    `${$_("access.minDissolveDelayN", {
                        values: { n: gate.minDissolveDelay / (24 * 60 * 60 * 1000) },
                    })}`
                );
            }
            if (gate.minStakeE8s) {
                parts.push(
                    `${$_("access.minStakeN", { values: { n: gate.minStakeE8s / E8S_PER_TOKEN } })}`
                );
            }
        }
        return parts.length > 0 ? ` (${parts.join(", ")})` : "";
    }
</script>

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "diamond_gate"}
        <TooltipWrapper {position} {align}>
            <div on:click={() => dispatch("upgrade")} slot="target" class="diamond">💎</div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    {$_("access.diamondGateInfo")}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if isSnsGate(gate)}
        <TooltipWrapper {position} {align}>
            <div slot="target" class={`icon ${snsGateBindings[gate.kind].cssClass}`} class:small />
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <p>
                        {`${$_("access.snsHolderInfo", {
                            values: snsGateBindings[gate.kind].labelParams,
                        })}`}
                    </p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
{/if}

<style lang="scss">
    $size: 32px;
    .icon {
        height: $size;
        width: $size;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
        background-size: contain;
        position: relative;

        &.small {
            height: 26px;
            width: 26px;
        }
    }
    .diamond {
        cursor: pointer;
        @include font-size(fs-130);
    }
    .oc {
        background-image: url("../assets/spinner.svg");
    }
    .sns1 {
        background-image: url("../assets/sns1_token.png");
    }
    .kinic {
        background-image: url("../assets/kinic_token.png");
    }
    .hotornot {
        background-image: url("../assets/hot_token.svg");
    }

    .params {
        margin-top: $sp3;
    }
</style>
