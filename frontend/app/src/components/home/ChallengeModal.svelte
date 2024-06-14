<script lang="ts">
    import type { Challenge, OpenChat, ResourceKey } from "openchat-client";
    import ModalContent from "../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Legend from "../Legend.svelte";

    const client = getContext<OpenChat>("client");

    let challenge: Challenge | undefined = undefined;
    let error: ResourceKey | undefined = undefined;
    let chars: string | undefined = undefined;
    let submitting = false;

    $: valid = challenge !== undefined && chars?.length === 4;

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
            } else {
                error = i18nKey("challenge.alreadyRegistered");
            }
        });
    }

    function submit() {
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

<ModalContent width={400} on:close={cancel} closeIcon>
    <div class="header login" slot="header">
        <Translatable resourceKey={i18nKey("challenge.title")} />
    </div>
    <div class="challenge" slot="body">
        {#if challenge === undefined}
            <div class="loader"><FancyLoader /></div>
        {:else}
            <img alt="captcha" src={challenge.pngBase64} />

            <form class="chars-wrapper" on:submit|preventDefault={submit}>
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
    <div slot="footer">
        <ButtonGroup align={"fill"}>
            <Button disabled={!valid || submitting} loading={submitting} on:click={submit}
                >{$_("next")}</Button>
            <Button secondary on:click={cancel}>{$_("cancel")}</Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    :global(.body) {
        padding-bottom: 0 !important;
    }

    .loader {
        width: 100px;
    }
    .challenge {
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
