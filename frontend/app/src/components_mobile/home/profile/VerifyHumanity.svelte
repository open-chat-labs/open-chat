<script lang="ts">
    import {
        Body,
        ColourVars,
        Column,
        CommonButton,
        Container,
        Row,
        Sheet,
        Subtitle,
    } from "component-lib";
    import { type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { uniquePersonCredentialGate } from "../../../utils/access";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import LinkAccounts from "./LinkAccounts.svelte";
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
    let iiPrincipal: string | undefined = $state(undefined);
    let checkingPrincipal = $state(true);

    onMount(() => {
        client
            .getLinkedIIPrincipal()
            .then((p) => {
                iiPrincipal = p;
                if (iiPrincipal !== undefined) {
                    verify();
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
    <Sheet>
        <Column crossAxisAlignment={"center"} mainAxisAlignment={"center"} padding={"xl"}>
            <div class="loader">
                <FancyLoader />
            </div>
        </Column>
    </Sheet>
{:else if step === "linking"}
    <LinkAccountsModal>
        <LinkAccounts
            bind:iiPrincipal
            {onClose}
            onProceed={() => (step = "verification")}
            explanations={[i18nKey("identity.humanityWarning")]} />
    </LinkAccountsModal>
{:else}
    <Sheet>
        <Column gap={"xl"} padding={"xl"}>
            <Row crossAxisAlignment={"center"} gap={"sm"}>
                <AccountCheck size={"1.5rem"} color={ColourVars.textPrimary} />
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("access.uniquePerson")} />
                </Subtitle>
            </Row>
            <Column gap={"md"}>
                {#if failed}
                    <Body>
                        <ErrorMessage>
                            <Translatable resourceKey={i18nKey("human.failed")} />
                        </ErrorMessage>
                    </Body>

                    <Body>
                        <Translatable resourceKey={i18nKey("access.uniquePersonInfo1")} />
                    </Body>

                    <Body>
                        <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
                    </Body>

                    <Body>
                        <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")} />
                    </Body>
                {:else}
                    <Body>
                        <Translatable resourceKey={i18nKey("human.instruction")} />
                    </Body>
                {/if}
            </Column>

            <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")}></Translatable>
                </CommonButton>
                <CommonButton
                    loading={verifying}
                    disabled={verifying || iiPrincipal === undefined}
                    onClick={verify}
                    size={"medium"}
                    mode={"active"}>
                    {#snippet icon(color, size)}
                        <AccountStar {color} {size}></AccountStar>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("access.verify")}></Translatable>
                </CommonButton>
            </Container>
        </Column>
    </Sheet>
{/if}

<style lang="scss">
    :global(.link-ii-logo img) {
        width: 24px;
    }

    .loader {
        width: 100px;
        margin: 100px auto;
    }
</style>
