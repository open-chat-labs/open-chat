<script lang="ts">
    import { mobileWidth, type Challenge, type OpenChat, type ResourceKey } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";

    const client = getContext<OpenChat>("client");

    let challenge: Challenge | undefined = $state(undefined);
    let error: ResourceKey | undefined = $state(undefined);
    let chars: string = $state("");
    let submitting = $state(false);

    let valid = $derived(challenge !== undefined && chars?.length === 4);

    onMount(() => {
        client.gaTrack("opened_challenge_modal", "registration");
        generate();
    });

    function cancel() {
        client.logout();
    }

    function generate() {
        challenge = undefined;

        client.generateIdentityChallenge().then((resp) => {
            if (resp.kind === "success") {
                challenge = resp as Challenge;
                error = undefined;
            } else if (resp.kind === "throttled") {
                error = i18nKey("challenge.throttled");
            } else if (resp.kind === "failed") {
                error = i18nKey("challenge.failed");
            } else {
                error = i18nKey("challenge.alreadyRegistered");
            }
        });
    }

    function submit(e: Event) {
        e.preventDefault();
        if (!valid || challenge === undefined || chars === undefined) {
            return;
        }

        submitting = true;

        client
            .submitChallenge({
                key: challenge.key,
                chars,
            })
            .then((success) => {
                if (!success) {
                    error = i18nKey("challenge.failed");
                    generate();
                }
            })
            .finally(() => (submitting = false));
    }
</script>

<div class="challenge">
    <ModalContent fitToContent={!$mobileWidth} fixedWidth={$mobileWidth}>
        {#snippet header()}
            <div class="header login">
                <div class="title">
                    <Translatable resourceKey={i18nKey("challenge.title")} />
                </div>
                <div title={$_("cancel")} class="close" onclick={cancel}>
                    <HoverIcon>
                        <CloseIcon size={"1em"} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                {#if challenge === undefined}
                    <div class="loader"><FancyLoader /></div>
                {:else}
                    <img alt="captcha" src={challenge.pngBase64} />

                    <form class="chars-wrapper" onsubmit={submit}>
                        <Legend label={i18nKey("challenge.prompt")} />
                        <Input
                            invalid={error !== undefined}
                            autofocus
                            bind:value={chars}
                            minlength={4}
                            maxlength={4} />
                    </form>
                {/if}
                {#if error !== undefined}
                    <ErrorMessage><Translatable resourceKey={error} /></ErrorMessage>
                {/if}
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup align={"fill"}>
                <Button disabled={!valid || submitting} loading={submitting} onClick={submit}
                    >{$_("next")}</Button>
                <Button secondary onClick={cancel}>{$_("cancel")}</Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</div>

<style lang="scss">
    :global(.challenge .body) {
        padding-top: $sp2;
        padding-bottom: 0;
    }

    .challenge {
        @include mobile() {
            width: 100%;
        }
    }
    .loader {
        width: 100px;
    }
    .header {
        display: flex;
        flex-direction: row;
        width: 320px;

        @include mobile() {
            width: 100%;
        }

        .title {
            flex: 1;
        }

        .close {
            flex: 0;
            position: relative;
            top: -$sp3;
            right: -$sp4;
        }
    }
    .body {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: $sp6;

        img {
            width: 100%;
        }
    }
    .chars-wrapper {
        width: 100%;
    }
</style>
