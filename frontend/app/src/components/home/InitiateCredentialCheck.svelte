<script lang="ts">
    import type { CredentialGate, Level, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let gate: CredentialGate;
    export let level: Level;

    let failed = false;
    let verifying = false;

    function verify() {
        verifying = true;
        client
            .verifyAccessGate(gate)
            .then((credential) => {
                if (credential === undefined) {
                    failed = true;
                } else {
                    dispatch("credentialReceived", credential);
                }
            })
            .catch(() => (failed = true))
            .finally(() => (verifying = false));
    }
</script>

<ModalContent on:close>
    <div class="header" slot="header">
        <div class="credential">🔒️</div>
        <div class="title">
            <Translatable resourceKey={i18nKey("access.initiateCredentialCheck")} />
        </div>
    </div>
    <div slot="body">
        <Translatable
            resourceKey={i18nKey(
                "access.credentialCheckMessage",
                {
                    credential: gate.credentialId,
                    issuer: gate.issuerOrigin,
                },
                level,
                true,
            )} />
        {#if failed}
            <ErrorMessage>
                <Translatable resourceKey={i18nKey("failed to verify the credential")} />
            </ErrorMessage>
        {/if}
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            <Button loading={verifying} disabled={verifying} on:click={verify}
                ><Translatable resourceKey={i18nKey("access.verify")} /></Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .credential {
        cursor: pointer;
        @include font-size(fs-130);
    }
</style>
