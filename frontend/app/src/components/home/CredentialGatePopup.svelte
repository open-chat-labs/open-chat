<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CredentialGate } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { findPredefinedIssuer } from "../../utils/access";

    export let gate: CredentialGate;
    $: issuer = findPredefinedIssuer(gate);
</script>

{#if issuer !== undefined}
    <Translatable
        resourceKey={i18nKey("access.credentialGateInfo", {
            credential: issuer.name,
        })} />
{/if}
