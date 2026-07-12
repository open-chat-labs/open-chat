<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CredentialGate } from "@client";
    import Translatable from "@src/ui/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";

    interface Props {
        gate: CredentialGate;
    }

    let { gate }: Props = $props();
</script>

<Translatable
    resourceKey={i18nKey("access.credential.credentialGateInfo", {
        credential: gate.credential.credentialName,
    })} />
