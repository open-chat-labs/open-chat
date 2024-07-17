<script lang="ts">
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import LinkVariant from "svelte-material-icons/LinkVariant.svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { OpenChat, ResourceKey } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let explanations: ResourceKey[];

    let failed = false;
    let step: "explain" | "linking" = "explain";
    let substep: "current" | "next" | "link" = "current";

    function linkIdentity() {
        step = "linking";
    }
</script>

<ModalContent fadeDelay={0} fadeDuration={0}>
    <div slot="header" class="header">
        <LinkVariant size={$iconSize} color={"var(--txt)"} />
        <div class="title">
            <Translatable resourceKey={i18nKey("identity.linkIdentity")} />
        </div>
    </div>
    <div slot="body">
        {#if failed}
            <p class="info">
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("identity.failed")} />
                </ErrorMessage>
            </p>
        {/if}
        {#if step === "explain"}
            <div class="explain">
                <div class="explain-icon">
                    <Alert size={$iconSize} color={"var(--warn"} />
                </div>
                <div class="explain-txt">
                    {#each explanations as explanation}
                        <p class="info">
                            <Translatable resourceKey={explanation} />
                        </p>
                    {/each}
                </div>
            </div>
        {:else if step === "linking"}
            {#if substep === "current"}
                <p class="info">
                    <Translatable resourceKey={i18nKey("identity.signInCurrent")} />
                </p>
            {:else if substep === "next"}
                <p class="info">
                    <Translatable resourceKey={i18nKey("identity.signInNext")} />
                </p>
            {/if}
        {/if}
    </div>

    <div let:onClose slot="footer">
        <ButtonGroup>
            <Button secondary on:click={onClose}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            {#if step === "explain"}
                <Button secondary on:click={linkIdentity}>
                    <span class="link-ii-logo">
                        <InternetIdentityLogo />
                    </span>
                    <Translatable resourceKey={i18nKey("identity.link")} /></Button>
                <Button on:click={() => dispatch("proceed")}
                    ><Translatable resourceKey={i18nKey("identity.proceed")} /></Button>
            {:else if step === "linking"}
                <Button secondary on:click={() => (step = "explain")}
                    ><Translatable resourceKey={i18nKey("identity.back")} /></Button>
                {#if substep === "current"}
                    <Button on:click={() => (substep = "next")}
                        ><Translatable resourceKey={i18nKey("login")} /></Button>
                {:else if substep === "next"}
                    <Button on:click={() => (substep = "link")}
                        ><Translatable resourceKey={i18nKey("login")} /></Button>
                {/if}
            {/if}
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .info {
        margin-bottom: $sp4;
    }

    .explain {
        padding: $sp4;
        border: 1px solid var(--warn);
        display: flex;
        align-items: flex-start;
        gap: $sp3;
        border-radius: var(--rd);

        .explain-icon {
            flex: 0 0 25px;
        }

        .explain-txt {
            flex: auto;
        }
    }
</style>
