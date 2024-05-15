<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Overlay from "./Overlay.svelte";
    import { _ } from "svelte-i18n";
    import Input from "./Input.svelte";
    import Markdown from "./home/Markdown.svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    export let message: ResourceKey | undefined = undefined;
    export let action: (yes: boolean) => Promise<void>;
    export let doubleCheck: { challenge: ResourceKey; response: ResourceKey } | undefined =
        undefined;
    export let title: ResourceKey | undefined = i18nKey("areYouSure");
    export let yesLabel: ResourceKey | undefined = i18nKey("yesPlease");
    export let noLabel: ResourceKey | undefined = i18nKey("noThanks");

    let inProgress = false;
    let response = "";

    $: canConfirm =
        !inProgress &&
        (doubleCheck === undefined || response === interpolate($_, doubleCheck.response));

    function onClick(yes: boolean) {
        if (yes) {
            inProgress = true;
        }

        action(yes).finally(() => {
            inProgress = false;
        });
    }
</script>

<Overlay>
    <ModalContent hideBody={message === undefined}>
        <span slot="header">
            {#if title !== undefined}
                <Translatable resourceKey={title} />
            {/if}
        </span>
        <span slot="body">
            {#if message !== undefined}
                <Markdown inline={false} text={interpolate($_, message)} />

                {#if doubleCheck !== undefined}
                    <p class="challenge">
                        <Markdown text={interpolate($_, doubleCheck.challenge)} />
                    </p>
                    <Input
                        invalid={false}
                        disabled={inProgress}
                        autofocus
                        bind:value={response}
                        minlength={0}
                        maxlength={200}
                        countdown={false} />
                {/if}
            {/if}
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button disabled={inProgress} small on:click={() => onClick(false)} secondary>
                    {#if noLabel !== undefined}
                        <Translatable resourceKey={noLabel} />
                    {/if}
                </Button>
                <Button
                    loading={inProgress}
                    disabled={!canConfirm}
                    small
                    on:click={() => onClick(true)}>
                    {#if yesLabel !== undefined}
                        <Translatable resourceKey={yesLabel} />
                    {/if}
                </Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .challenge {
        margin: $sp3 0;
    }
</style>
