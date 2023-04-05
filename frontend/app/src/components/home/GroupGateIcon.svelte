<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import type { GroupGate } from "openchat-client";

    export let gate: GroupGate;
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
                    {$_("group.chatHolderInfo")}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gate.kind === "sns1_gate"}
        <TooltipWrapper bottomOffset={-10} alignRight={!rtlStore} centreChevron={true}>
            <div slot="target" class="icon sns1" />
            <div slot="tooltip">
                <TooltipPopup alignRight={!rtlStore}>
                    {$_("group.sns1HolderInfo")}
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
    }
    .diamond {
        @include font-size(fs-140);
    }
    .oc {
        background-image: url("../assets/spinner.svg");
    }
    .sns1 {
        background-image: url("../assets/sns1_token.png");
    }
</style>
