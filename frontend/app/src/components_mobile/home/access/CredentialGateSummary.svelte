<script lang="ts">
    import { type CredentialGate } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    interface Props {
        gate: CredentialGate;
    }

    let { gate }: Props = $props();
</script>

<div class="detail">
    <div>
        <Translatable resourceKey={i18nKey("access.credential.label")} />
    </div>
    <div class="params">
        <div>
            <Translatable
                resourceKey={i18nKey("access.credential.credentialParamCredential", {
                    credential: gate.credential.credentialName,
                })} />
        </div>
    </div>
</div>

<style lang="scss">
    .params {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }
</style>
