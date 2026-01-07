<script lang="ts">
    import {
        Column,
        CommonButton,
        Form,
        IconButton,
        Input,
        Row,
        Sheet,
        Subtitle,
    } from "component-lib";
    import { type Challenge, type OpenChat, type ResourceKey } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import CloseIcon from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ErrorMessage from "../ErrorMessage.svelte";
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

<Sheet>
    <Column gap={"xl"} padding={"xl"}>
        <Row mainAxisAlignment={"spaceBetween"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("challenge.title")} />
                <IconButton onclick={cancel}>
                    {#snippet icon(color)}
                        <CloseIcon {color} />
                    {/snippet}
                </IconButton>
            </Subtitle>
        </Row>
        <Column gap={"lg"}>
            {#if challenge === undefined}
                <div class="loader"><FancyLoader /></div>
            {:else}
                <img alt="captcha" src={challenge.pngBase64} />

                <Form onSubmit={submit}>
                    <Input
                        error={error !== undefined}
                        autofocus
                        bind:value={chars}
                        minlength={4}
                        maxlength={4}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("challenge.prompt")} />
                        {/snippet}
                    </Input>
                </Form>
            {/if}
            {#if error !== undefined}
                <ErrorMessage><Translatable resourceKey={error} /></ErrorMessage>
            {/if}
        </Column>

        <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <CommonButton size={"small_text"} onClick={cancel}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
            <CommonButton
                disabled={!valid || submitting}
                loading={submitting}
                onClick={submit}
                mode={"active"}
                size={"medium"}>
                <Translatable resourceKey={i18nKey("next")} />
            </CommonButton>
        </Row>
    </Column>
</Sheet>

<style lang="scss">
    .loader {
        width: 100px;
    }
</style>
