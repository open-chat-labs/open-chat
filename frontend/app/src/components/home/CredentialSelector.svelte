<script lang="ts">
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";
    import { credentialIssuers, type CredentialIssuer, type Credential } from "../../utils/access";
    import type { CredentialGate } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let gate: CredentialGate;

    let selectedCredentialIssuer: CredentialIssuer;
    let selectedCredential: Credential;

    onMount(() => {
        selectedCredentialIssuer = credentialIssuers[0];
        selectedCredential = credentialIssuers[0].credentials[0];
        sync();
    });

    function sync() {
        gate.issuerOrigin = selectedCredentialIssuer.value;
        gate.credentialId = selectedCredential.value;
    }

    function issuerChanged() {
        selectedCredential = selectedCredentialIssuer.credentials[0];
        sync();
    }

    function credentialChanged() {
        sync();
    }
</script>

<Legend label={i18nKey("access.credentialIssuer")} />
<Select on:change={issuerChanged} bind:value={selectedCredentialIssuer}>
    {#each credentialIssuers as issuer}
        <option value={issuer}>{issuer.name}</option>
    {/each}
</Select>
{#if selectedCredentialIssuer !== undefined}
    <Legend label={i18nKey("access.requiredCredential")} />
    <Select on:change={credentialChanged} bind:value={selectedCredential}>
        {#each selectedCredentialIssuer.credentials as credential}
            <option value={credential}>{credential.name}</option>
        {/each}
    </Select>
{/if}
