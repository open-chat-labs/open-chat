<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CredentialGate, Level, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { interpolateLevel } from "../../utils/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";

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
        <div class="title">{$_("access.initiateCredentialCheck")}</div>
    </div>
    <div slot="body">
        {interpolateLevel("access.credentialCheckMessage", level, true, {
            credential: gate.credentialId,
            issuer: gate.issuerOrigin,
        })}
        {#if failed}
            <ErrorMessage>
                {$_("failed to verify the credential")}
            </ErrorMessage>
        {/if}
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}>{$_("cancel")}</Button>
            <Button loading={verifying} disabled={verifying} on:click={verify}
                >{$_("access.verify")}</Button>
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
