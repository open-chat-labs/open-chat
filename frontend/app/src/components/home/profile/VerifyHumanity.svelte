<script lang="ts">
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { uniquePersonCredentialGate } from "../../../utils/access";
    import Markdown from "../Markdown.svelte";
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import LinkAccounts from "./LinkAccounts.svelte";
    import HumanityConfirmation from "../HumanityConfirmation.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import LinkAccountsModal from "./LinkAccountsModal.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        onSuccess: () => void;
    }

    let { onClose, onSuccess }: Props = $props();

    let failed = $state(false);
    let verifying = $state(false);
    let step: "linking" | "verification" = $state("linking");
    let confirmed = $state(false);
    let iiPrincipal: string | undefined = $state(undefined);
    let checkingPrincipal = $state(true);

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
        if (iiPrincipal === undefined) return;
        const iiPrincipalCopy = iiPrincipal;

        verifying = true;
        failed = false;
        client
            .verifyAccessGate(uniquePersonCredentialGate, iiPrincipalCopy)
            .then((credential) => {
                if (credential === undefined) {
                    failed = true;
                } else {
                    return client
                        .submitProofOfUniquePersonhood(credential, iiPrincipalCopy)
                        .then((resp) => {
                            if (resp.kind !== "success") {
                                failed = true;
                            } else {
                                onSuccess();
                            }
                        });
                }
            })
            .catch(() => (failed = true))
            .finally(() => (verifying = false));
    }
</script>

{#if checkingPrincipal}
    <ModalContent hideFooter hideHeader fadeDelay={0} fadeDuration={0}>
        {#snippet body()}
            <div>
                <div class="loader">
                    <FancyLoader />
                </div>
            </div>
        {/snippet}
    </ModalContent>
{:else if step === "linking"}
    <LinkAccountsModal>
        <LinkAccounts
            bind:iiPrincipal
            on:close
            on:proceed={() => (step = "verification")}
            explanations={[i18nKey("identity.humanityWarning")]} />
    </LinkAccountsModal>
{:else}
    <ModalContent fadeDelay={0} fadeDuration={0}>
        {#snippet header()}
            <div class="header">
                <AccountCheck size={$iconSize} color={"var(--txt)"} />
                <div class="title">
                    <Translatable resourceKey={i18nKey("access.uniquePerson")} />
                </div>
            </div>
        {/snippet}
        {#snippet body()}
            <div>
                {#if failed}
                    <p class="info">
                        <ErrorMessage>
                            <Translatable resourceKey={i18nKey("human.failed")} />
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
                        <Translatable resourceKey={i18nKey("human.instruction")} />
                    </p>
                    <HumanityConfirmation bind:confirmed />
                {/if}
            </div>
        {/snippet}

        {#snippet footer()}
            <div>
                <ButtonGroup>
                    <Button secondary on:click={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <!-- <Button secondary on:click={() => (step = "linking")}
                        ><Translatable resourceKey={i18nKey("identity.back")} /></Button> -->
                    <Button
                        loading={verifying}
                        disabled={verifying || !confirmed || iiPrincipal === undefined}
                        on:click={verify}
                        ><Translatable resourceKey={i18nKey("access.verify")} /></Button>
                </ButtonGroup>
            </div>
        {/snippet}
    </ModalContent>
{/if}

<style lang="scss">
    :global(.link-ii-logo img) {
        width: 24px;
    }

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
