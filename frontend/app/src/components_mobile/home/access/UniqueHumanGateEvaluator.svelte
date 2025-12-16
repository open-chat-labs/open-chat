<script lang="ts">
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        StatusCard,
    } from "component-lib";
    import { iconSize, type Level, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { uniquePersonCredentialGate } from "../../../utils/access";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";
    import HumanityConfirmation from "../HumanityConfirmation.svelte";
    import Markdown from "../Markdown.svelte";
    import LinkAccounts from "../profile/LinkAccounts.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        level: Level;
        expiry: bigint | undefined;
        onCredentialReceived: (cred: string) => void;
        onClose: () => void;
    }

    let { level, expiry, onClose, onCredentialReceived }: Props = $props();

    let failed = $state(false);
    let verifying = $state(false);
    let confirmed = $state(false);
    let step: "linking" | "verification" = $state("linking");
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
        verifying = true;
        failed = false;
        if (iiPrincipal === undefined) return;
        client
            .verifyAccessGate(uniquePersonCredentialGate, iiPrincipal)
            .then((credential) => {
                if (credential === undefined) {
                    failed = true;
                } else {
                    onCredentialReceived(credential);
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
        {onClose}
        onProceed={() => (step = "verification")}
        explanations={[i18nKey("identity.humanityWarning")]} />
{:else}
    <Row gap={"md"} crossAxisAlignment={"center"}>
        <AccountCheck size={$iconSize} color={"var(--txt)"} />
        <H2 fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("access.uniquePerson")} />
        </H2>
    </Row>
    <div>
        {#if failed}
            <Column gap={"lg"}>
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

                <Body>
                    <Translatable resourceKey={i18nKey("access.uniquePersonInfo1")} />
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
                </BodySmall>

                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")} />
                </BodySmall>
            </Column>
        {:else}
            <Column gap={"lg"}>
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "access.credential.credentialCheckMessage",
                            {
                                credential: "Unique person",
                            },
                            level,
                            true,
                        )} />
                </BodySmall>

                <HumanityConfirmation bind:confirmed />

                {#if expiry !== undefined}
                    <StatusCard
                        background={ColourVars.background2}
                        mode={"warning"}
                        title={interpolate($_, i18nKey("Recurring access gate"))}>
                        {#snippet body()}
                            <AccessGateExpiry {expiry} />
                        {/snippet}
                    </StatusCard>
                {/if}
            </Column>
        {/if}
    </div>
    <Column gap={"md"} crossAxisAlignment={"center"}>
        <Button
            loading={verifying}
            disabled={verifying || !confirmed || iiPrincipal === undefined}
            onClick={verify}><Translatable resourceKey={i18nKey("access.verify")} /></Button>
        <CommonButton width={"hug"} size={"small_text"} onClick={onClose}
            ><Translatable resourceKey={i18nKey("cancel")} /></CommonButton>
    </Column>
{/if}

<style lang="scss">
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
