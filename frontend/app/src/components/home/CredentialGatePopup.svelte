<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CredentialGate } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { credentialIssuers } from "../../utils/access";

    export let gate: CredentialGate;

    $: issuer = credentialIssuers.find(
        (i) =>
            i.credentialType === gate.credential.credentialType &&
            i.issuerOrigin === gate.credential.issuerOrigin,
    );
</script>

{#if issuer !== undefined}
    <Translatable
        resourceKey={i18nKey("access.credentialGateInfo", {
            credential: issuer.name,
        })} />
{/if}
