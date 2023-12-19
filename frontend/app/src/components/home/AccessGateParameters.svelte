<script lang="ts">
    import { _ } from "svelte-i18n";
    import {
        OpenChat,
        type CredentialGate,
        type NeuronGate,
        type PaymentGate,
    } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let gate: NeuronGate | CredentialGate | PaymentGate;
    $: tokenDetails = client.getTokenDetailsForAccessGate(gate);
</script>

{#if gate.kind === "credential_gate"}
    <div class="detail">
        <div>
            {$_("access.credential")}
        </div>
        <div class="params">
            <div>
                {`${$_("access.credentialParamIssuer", {
                    values: { issuer: gate.issuerOrigin },
                })}`}
            </div>
            <div>
                {`${$_("access.credentialParamCredential", {
                    values: { credential: gate.credentialId },
                })}`}
            </div>
        </div>
    </div>
{:else if gate.kind === "payment_gate" && tokenDetails !== undefined}
    <div class="detail">
        <div>
            {$_("access.tokenPayment", { values: { token: tokenDetails.symbol } })}
        </div>
        <div class="params">
            <div>
                {`${$_("access.amountN", {
                    values: { n: client.formatTokens(gate.amount, tokenDetails.decimals) },
                })}`}
            </div>
        </div>
    </div>
{:else if gate.kind === "neuron_gate" && tokenDetails !== undefined}
    <div class="detail">
        <div>
            {$_("access.tokenNeuronHolder", { values: { token: tokenDetails.symbol } })}
        </div>
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
                    {`${$_("access.minStakeN", {
                        values: {
                            n: client.formatTokens(
                                BigInt(gate.minStakeE8s),
                                tokenDetails?.decimals ?? 8,
                            ),
                        },
                    })}`}
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
