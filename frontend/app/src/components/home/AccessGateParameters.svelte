<script lang="ts">
    import { _ } from "svelte-i18n";
    import { E8S_PER_TOKEN, OpenChatNeuronGate, Sns1NeuronGate } from "openchat-client";

    export let gate: Sns1NeuronGate | OpenChatNeuronGate;
</script>

<div class="detail">
    <div>{gate.kind === "openchat_gate" ? $_("access.chatHolder") : $_("access.sns1Holder")}</div>
    <div class="params">
        {#if gate.minDissolveDelay}
            <div>
                {`${$_("access.minDissolveDelayN", {
                    values: { n: gate.minDissolveDelay / (24 * 60 * 60 * 1000) },
                })}`}
            </div>
        {/if}
        {#if gate.minStakeE8s}
            <div>
                {`${$_("access.minStakeN", { values: { n: gate.minStakeE8s / E8S_PER_TOKEN } })}`}
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .params {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }
</style>
