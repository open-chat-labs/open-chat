<script lang="ts">
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import type { OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { uniquePersonCredentialGate } from "../../../utils/access";
    import Markdown from "../Markdown.svelte";
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import LinkAccounts from "./LinkAccounts.svelte";
    import HumanityConfirmation from "../HumanityConfirmation.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let failed = false;
    let verifying = false;
    let step: "linking" | "verification" = "verification";
    let error: string | undefined = undefined;
    let confirmed = false;

    function verify() {
        verifying = true;
        failed = false;
        client
            .verifyAccessGate(uniquePersonCredentialGate)
            .then((credential) => {
                if (credential === undefined) {
                    failed = true;
                } else {
                    return client.submitProofOfUniquePersonhood(credential).then((resp) => {
                        if (resp.kind !== "success") {
                            failed = true;
                        } else {
                            dispatch("success");
                        }
                    });
                }
            })
            .catch(() => (failed = true))
            .finally(() => (verifying = false));
    }
</script>

<Overlay>
    {#if step === "linking"}
        <LinkAccounts
            bind:error
            on:close
            on:proceed={() => (step = "verification")}
            explanations={[i18nKey("identity.warning1"), i18nKey("identity.warning2")]} />
    {:else}
        <ModalContent fadeDelay={0} fadeDuration={0}>
            <div slot="header" class="header">
                <AccountCheck size={$iconSize} color={"var(--txt)"} />
                <div class="title">
                    <Translatable resourceKey={i18nKey("access.uniquePerson")} />
                </div>
            </div>
            <div slot="body">
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

            <div slot="footer">
                <ButtonGroup>
                    <Button secondary on:click={() => dispatch("close")}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <!-- <Button secondary on:click={() => (step = "linking")}
                        ><Translatable resourceKey={i18nKey("identity.back")} /></Button> -->
                    <Button loading={verifying} disabled={verifying || !confirmed} on:click={verify}
                        ><Translatable resourceKey={i18nKey("access.verify")} /></Button>
                </ButtonGroup>
            </div>
        </ModalContent>
    {/if}
</Overlay>

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
</style>
