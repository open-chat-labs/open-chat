<script lang="ts">
    import type { CredentialGate, Level, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let gate: CredentialGate;
    export let level: Level;

    let failed = false;
    let verifying = false;

    function verify() {
        verifying = true;
        failed = false;
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

<div class="header">
    <div class="credential">🔒️</div>
    <div class="title">
        <Translatable resourceKey={i18nKey("access.credential.initiateCredentialCheck")} />
    </div>
</div>
<div>
    {#if failed}
        <ErrorMessage>
            <Translatable
                resourceKey={i18nKey(
                    "access.credential.credentialCheckFailed",
                    {
                        credential: gate.credential.credentialName,
                    },
                    level,
                    true,
                )} />
        </ErrorMessage>
    {:else}
        <Translatable
            resourceKey={i18nKey(
                "access.credential.credentialCheckMessage",
                {
                    credential: gate.credential.credentialName,
                },
                level,
                true,
            )} />
    {/if}
</div>
<div>
    <ButtonGroup>
        <Button secondary on:click={() => dispatch("close")}
            ><Translatable resourceKey={i18nKey("cancel")} /></Button>
        <Button loading={verifying} disabled={verifying} on:click={verify}
            ><Translatable resourceKey={i18nKey("access.verify")} /></Button>
    </ButtonGroup>
</div>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .credential {
        cursor: pointer;
        @include font-size(fs-130);
    }
</style>
