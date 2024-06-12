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

    const client = getContext<OpenChat>("client");

    let challenge: Challenge | undefined = undefined;
    let error: ResourceKey | undefined = undefined;
    let chars: string | undefined = undefined;

    $: identityState = client.identityState;
    $: valid = challenge !== undefined && chars?.length === 5;

    onMount(() => {
        client.gaTrack("opened_challenge_modal", "registration");
        generate();
    });

    function cancel() {
        identityState.set({ kind: "logging_in" });
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
            });
    }
</script>

<ModalContent on:close={cancel} closeIcon>
    <div class="header login" slot="header">
        <Translatable resourceKey={i18nKey("challenge.title")} />
    </div>
    <div class="challenge" slot="body">
        {#if challenge === undefined}
            <div><FancyLoader /></div>
        {:else}
            <div class="captcha">
                <img alt="captcha" src={`data:image/png;base64, ${challenge.pngBase64}`} />
            </div>

            <form class="chars-wrapper" on:submit|preventDefault={submit}>
                <Input
                    invalid={error !== undefined}
                    autofocus
                    bind:value={chars}
                    minlength={5}
                    maxlength={5} />
            </form>
        {/if}
        {#if error !== undefined}
            <ErrorMessage><Translatable resourceKey={error} /></ErrorMessage>
        {/if}
    </div>
    <div slot="footer">
        <ButtonGroup align={"fill"}>
            <Button disabled={!valid} on:click={submit}>{$_("next")}</Button>
            <Button secondary={true} on:click={cancel}>{$_("cancel")}</Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .challenge {
        display: flex;
        justify-content: center;
        flex-direction: column;
        gap: $sp4;
    }
    .captcha {
        display: flex;
        justify-content: center;
        margin-bottom: $sp4;
        height: 120px;
    }
    .chars-wrapper {
        width: 80%;
        @include size-below(xs) {
            width: 100%;
        }
    }
</style>
