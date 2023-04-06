<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import { E8S_PER_TOKEN, GroupGate } from "openchat-client";

    export let gate: GroupGate;

    $: params = formatParams(gate);

    function formatParams(gate: GroupGate): string {
        const parts = [];
        if (gate.kind === "openchat_gate" || gate.kind === "sns1_gate") {
            if (gate.minDissolveDelay) {
                parts.push(
                    `${$_("group.minDissolveDelayN", {
                        values: { n: gate.minDissolveDelay / (24 * 60 * 60 * 1000) },
                    })}`
                );
            }
            if (gate.minStakeE8s) {
                parts.push(
                    `${$_("group.minStakeN", { values: { n: gate.minStakeE8s / E8S_PER_TOKEN } })}`
                );
            }
        }
        return parts.length > 0 ? ` (${parts.join(", ")})` : "";
    }
</script>

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "diamond_gate"}
        <TooltipWrapper bottomOffset={-10} alignRight={!rtlStore} centreChevron={true}>
            <div slot="target" class="diamond">💎</div>
            <div slot="tooltip">
                <TooltipPopup alignRight={!rtlStore}>
                    {$_("group.diamondGateInfo")}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gate.kind === "openchat_gate"}
        <TooltipWrapper bottomOffset={-10} alignRight={!rtlStore} centreChevron={true}>
            <div slot="target" class="icon oc" />
            <div slot="tooltip">
                <TooltipPopup alignRight={!rtlStore}>
                    <p>{`${$_("group.chatHolderInfo")}`}</p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gate.kind === "sns1_gate"}
        <TooltipWrapper bottomOffset={-10} alignRight={!rtlStore} centreChevron={true}>
            <div slot="target" class="icon sns1" />
            <div slot="tooltip">
                <TooltipPopup alignRight={!rtlStore}>
                    <p>{`${$_("group.sns1HolderInfo")}`}</p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
{/if}

<style type="text/scss">
    $size: 32px;
    .icon {
        height: $size;
        width: $size;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
        background-size: contain;
        position: relative;
    }
    .diamond {
        @include font-size(fs-130);
    }
    .oc {
        background-image: url("../assets/spinner.svg");
    }
    .sns1 {
        background-image: url("../assets/sns1_token.png");
    }

    .params {
        margin-top: $sp3;
    }
</style>
