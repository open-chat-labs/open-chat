<script lang="ts">
    import { type CredentialGate } from "openchat-client";
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
    <div class="detail">
        <div>
            <Translatable resourceKey={i18nKey("access.credential")} />
        </div>
        <div class="params">
            <div>
                <Translatable
                    resourceKey={i18nKey("access.credentialParamCredential", {
                        credential: issuer.name,
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
