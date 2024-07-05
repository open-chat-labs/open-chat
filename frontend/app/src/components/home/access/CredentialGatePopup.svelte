<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CredentialGate } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let gate: CredentialGate;
</script>

<Translatable
    resourceKey={i18nKey("access.credential.credentialGateInfo", {
        credential: gate.credential.credentialName,
    })} />
