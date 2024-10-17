<script lang="ts">
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import type { Level, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { uniquePersonCredentialGate } from "../../../utils/access";
    import Markdown from "../Markdown.svelte";
    import { _ } from "svelte-i18n";
    import HumanityConfirmation from "../HumanityConfirmation.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import LinkAccounts from "../profile/LinkAccounts.svelte";
    import AlertBox from "../../AlertBox.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let level: Level;
    export let expiry: bigint | undefined;

    let failed = false;
    let verifying = false;
    let confirmed = false;
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
            .verifyAccessGate(uniquePersonCredentialGate, iiPrincipal)
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
        explanations={[i18nKey("identity.humanityWarning")]} />
{:else}
    <div class="header">
        <AccountCheck size={$iconSize} color={"var(--txt)"} />
        <div class="title">
            <Translatable resourceKey={i18nKey("access.uniquePerson")} />
        </div>
    </div>
    <div>
        {#if failed}
            <p class="info">
                <ErrorMessage>
                    <Translatable
                        resourceKey={i18nKey(
                            "access.credential.credentialCheckFailed",
                            {
                                credential: "Unique person",
                            },
                            level,
                            true,
                        )} />
                </ErrorMessage>
            </p>
            <p class="question">
                <Translatable resourceKey={i18nKey("access.uniquePersonInfo1")} />
            </p>

            <p class="answer">
                <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
            </p>

            <p class="answer">
                <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")} />
            </p>
        {:else}
            <p class="info">
                <Translatable
                    resourceKey={i18nKey(
                        "access.credential.credentialCheckMessage",
                        {
                            credential: "Unique person",
                        },
                        level,
                        true,
                    )} />
            </p>

            <HumanityConfirmation bind:confirmed />

            {#if expiry !== undefined}
                <AlertBox>
                    <AccessGateExpiry {expiry} />
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
                disabled={verifying || !confirmed || iiPrincipal === undefined}
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

    .info,
    .question,
    .answer {
        margin-bottom: $sp4;
    }

    .question {
        @include font(book, normal, fs-90);
    }

    .answer {
        color: var(--txt-light);
        @include font(book, normal, fs-90);
    }

    .loader {
        width: 100px;
        margin: 100px auto;
    }
</style>
