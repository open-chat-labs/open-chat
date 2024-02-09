<script lang="ts">
    import {
        OpenChat,
        type CredentialGate,
        type NeuronGate,
        type PaymentGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import CredentialGateSummary from "./CredentialGateSummary.svelte";

    const client = getContext<OpenChat>("client");

    export let gate: NeuronGate | CredentialGate | PaymentGate;
    $: tokenDetails = client.getTokenDetailsForAccessGate(gate);
</script>

{#if gate.kind === "credential_gate"}
    <CredentialGateSummary {gate} />
{:else if gate.kind === "payment_gate" && tokenDetails !== undefined}
    <div class="detail">
        <div>
            <Translatable
                resourceKey={i18nKey("access.tokenPayment", { token: tokenDetails.symbol })} />
        </div>
        <div class="params">
            <div>
                <Translatable
                    resourceKey={i18nKey("access.amountN", {
                        n: client.formatTokens(gate.amount, tokenDetails.decimals),
                    })} />
            </div>
        </div>
    </div>
{:else if gate.kind === "neuron_gate" && tokenDetails !== undefined}
    <div class="detail">
        <div>
            <Translatable
                resourceKey={i18nKey("access.tokenNeuronHolder", {
                    token: tokenDetails.symbol,
                })} />
        </div>
        <div class="params">
            {#if gate.minDissolveDelay}
                <div>
                    <Translatable
                        resourceKey={i18nKey("access.minDissolveDelayN", {
                            n: gate.minDissolveDelay / (24 * 60 * 60 * 1000),
                        })} />
                </div>
            {/if}
            {#if gate.minStakeE8s}
                <div>
                    <Translatable
                        resourceKey={i18nKey("access.minStakeN", {
                            n: client.formatTokens(
                                BigInt(gate.minStakeE8s),
                                tokenDetails?.decimals ?? 8,
                            ),
                        })} />
                </div>
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .params {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }
</style>
