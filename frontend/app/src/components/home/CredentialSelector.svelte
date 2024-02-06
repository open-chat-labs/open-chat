<script lang="ts">
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";
    import { credentialIssuers, type CredentialIssuer } from "../../utils/access";
    import type { CredentialGate } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let gate: CredentialGate;

    let selectedCredentialIssuer: CredentialIssuer;

    onMount(() => {
        selectedCredentialIssuer = credentialIssuers[0];
        sync();
    });

    function sync() {
        gate.credential = { ...selectedCredentialIssuer };
    }

    function issuerChanged() {
        sync();
    }
</script>

<Legend label={i18nKey("access.credentialIssuer")} />
<Select on:change={issuerChanged} bind:value={selectedCredentialIssuer}>
    {#each credentialIssuers as issuer}
        <option value={issuer}>{issuer.name}</option>
    {/each}
</Select>
