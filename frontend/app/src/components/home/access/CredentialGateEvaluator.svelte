<script lang="ts">
    import type { CredentialGate, Level, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import LinkAccounts from "../profile/LinkAccounts.svelte";
    import AlertBox from "../../AlertBox.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let gate: CredentialGate & { expiry: bigint | undefined };
    export let level: Level;

    let failed = false;
    let verifying = false;
    let step: "linking" | "verification" = "linking";
    let iiPrincipal: string | undefined = undefined;
    let checkingPrincipal = true;

    onMount(() => {
        client
            .getLinkedIIPrincipal()
            .then((p) => {
                iiPrincipal = p;
                if (iiPrincipal !== undefined) {
                    step = "verification";
                }
            })
            .finally(() => (checkingPrincipal = false));
    });

    function verify() {
        verifying = true;
        failed = false;
        if (iiPrincipal === undefined) return;

        client
            .verifyAccessGate(gate, iiPrincipal)
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

{#if checkingPrincipal}
    <div class="loader">
        <FancyLoader />
    </div>
{:else if step === "linking"}
    <LinkAccounts
        bind:iiPrincipal
        on:close
        on:proceed={() => (step = "verification")}
        explanations={[
            i18nKey("identity.credentialWarning", { name: gate.credential.credentialName }),
        ]} />
{:else}
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
            {#if gate.expiry !== undefined}
                <AlertBox>
                    <AccessGateExpiry expiry={gate.expiry} />
                </AlertBox>
            {/if}
        {/if}
    </div>
    <div>
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            <Button
                loading={verifying}
                disabled={verifying || iiPrincipal === undefined}
                on:click={verify}><Translatable resourceKey={i18nKey("access.verify")} /></Button>
        </ButtonGroup>
    </div>
{/if}

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

    .loader {
        width: 100px;
        margin: 100px auto;
    }
</style>
