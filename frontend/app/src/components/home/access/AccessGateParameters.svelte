<script lang="ts">
    import {
        OpenChat,
        type CredentialGate,
        type NeuronGate,
        type PaymentGate,
        type TokenBalanceGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import CredentialGateSummary from "./CredentialGateSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: NeuronGate | CredentialGate | PaymentGate | TokenBalanceGate;
    }

    let { gate }: Props = $props();
    let tokenDetails = $derived(client.getTokenDetailsForAccessGate(gate));
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
{:else if gate.kind === "token_balance_gate" && tokenDetails !== undefined}
    <div class="detail">
        <div>
            <Translatable
                resourceKey={i18nKey("access.minimumTokenBalance", {
                    token: tokenDetails.symbol,
                })} />
        </div>
        <div class="params">
            <div>
                <Translatable
                    resourceKey={i18nKey("access.minimumBalanceN", {
                        n: client.formatTokens(gate.minBalance, tokenDetails.decimals),
                    })} />
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    .params {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }
</style>
