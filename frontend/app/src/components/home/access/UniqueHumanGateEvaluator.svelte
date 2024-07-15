<script lang="ts">
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import type { Level, OpenChat } from "openchat-client";
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

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let level: Level;

    let failed = false;
    let verifying = false;

    function verify() {
        verifying = true;
        failed = false;
        client
            .verifyAccessGate(uniquePersonCredentialGate)
            .then((credential) => {
                if (credential === undefined) {
                    failed = true;
                } else {
                    client.submitProofOfUniquePersonhood(credential).then((resp) => {
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
    {/if}
    <p class="question">
        <Translatable resourceKey={i18nKey("access.uniquePersonInfo1")} />
    </p>

    <p class="answer">
        <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
    </p>

    <p class="answer">
        <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")} />
    </p>
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

    .info,
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
