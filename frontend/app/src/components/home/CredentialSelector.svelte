<script lang="ts">
    import { fade } from "svelte/transition";
    import Radio from "../Radio.svelte";
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";
    import Input from "../Input.svelte";
    import { credentialIssuers, type CredentialIssuer } from "../../utils/access";
    import type { CredentialGate } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    export let gate: CredentialGate;

    let selectedCredentialIssuer: CredentialIssuer;
    let customIssuer = { ...credentialIssuers[0] };
    let issuerType: "predefined" | "custom" = "predefined";

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

    function toggleIssuerType() {
        issuerType = issuerType === "predefined" ? "custom" : "predefined";
    }
</script>

<Radio
    on:change={toggleIssuerType}
    checked={issuerType === "predefined"}
    id={"predefined-issuer"}
    align={"start"}
    group={"issuer-type"}>
    <div class="section-title">
        <p>
            <Translatable resourceKey={i18nKey("Choose a predenfined credential issuer")} />
        </p>
    </div>
    {#if issuerType === "predefined"}
        <div transition:fade|local={{ duration: 250 }} class="info">
            <Select on:change={issuerChanged} bind:value={selectedCredentialIssuer}>
                {#each credentialIssuers as issuer}
                    <option value={issuer}>{issuer.name}</option>
                {/each}
            </Select>
        </div>
    {/if}
</Radio>

<Radio
    on:change={toggleIssuerType}
    checked={issuerType === "custom"}
    id={"custom-issuer"}
    align={"start"}
    group={"issuer-type"}>
    <div class="section-title">
        <p>
            <Translatable resourceKey={i18nKey("Define a custom credential issuer")} />
        </p>
    </div>
    {#if issuerType === "custom"}
        <div transition:fade|local={{ duration: 250 }} class="info">
            <Legend label={i18nKey("Name")} />
            <Input bind:value={customIssuer.name} />

            <Legend label={i18nKey("CanisterId")} />
            <Input bind:value={customIssuer.issuerCanisterId} />

            <Legend label={i18nKey("Origin")} />
            <Input bind:value={customIssuer.issuerOrigin} />

            <Legend label={i18nKey("Credential type")} />
            <Input bind:value={customIssuer.credentialType} />
        </div>
    {/if}
</Radio>

<!-- <Legend label={i18nKey("access.predefinedCredentialIssuer")} />
<Select on:change={issuerChanged} bind:value={selectedCredentialIssuer}>
    {#each credentialIssuers as issuer}
        <option value={issuer}>{issuer.name}</option>
    {/each}
</Select> -->

<!-- {#if selectedCredentialIssuer === credentialIssuers[0]}
    <Legend label={i18nKey("Name")} />
    <Input bind:value={customIssuer.name} />

    <Legend label={i18nKey("CanisterId")} />
    <Input bind:value={customIssuer.issuerCanisterId} />

    <Legend label={i18nKey("Origin")} />
    <Input bind:value={customIssuer.issuerOrigin} />

    <Legend label={i18nKey("Credential type")} />
    <Input bind:value={customIssuer.credentialType} />
{/if} -->

<style lang="scss">
</style>
