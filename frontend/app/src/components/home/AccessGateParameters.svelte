<script lang="ts">
    import { _ } from "svelte-i18n";
    import {
        E8S_PER_TOKEN,
        OpenChat,
        type CredentialGate,
        type SNSAccessGate,
    } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let gate: SNSAccessGate | CredentialGate;
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = client.getTokenDetailsForSnsAccessGate(gate, $cryptoLookup);
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
{:else}
    <div class="detail">
        <div>
            {$_("access.snsHolder", {
                values: tokenDetails ? { token: tokenDetails.symbol } : undefined,
            })}
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
                        values: { n: gate.minStakeE8s / E8S_PER_TOKEN },
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
