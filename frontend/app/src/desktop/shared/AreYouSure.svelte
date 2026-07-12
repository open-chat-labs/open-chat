<script lang="ts">
    import type { ResourceKey } from "@client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import Markdown from "@src/ui/Markdown.svelte";
    import Input from "./Input.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Overlay from "@src/ui/Overlay.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    interface Props {
        message?: ResourceKey | undefined;
        action: (yes: boolean) => Promise<void>;
        doubleCheck?: { challenge: ResourceKey; response: ResourceKey } | undefined;
        title?: ResourceKey | undefined;
        yesLabel?: ResourceKey | undefined;
        noLabel?: ResourceKey | undefined;
        children?: Snippet;
    }

    let {
        message,
        action,
        doubleCheck,
        title = i18nKey("areYouSure"),
        yesLabel = i18nKey("yesPlease"),
        noLabel = i18nKey("noThanks"),
        children,
    }: Props = $props();

    let inProgress = $state(false);
    let response = $state("");

    let canConfirm = $derived(
        !inProgress &&
            (doubleCheck === undefined || response === interpolate($_, doubleCheck.response)),
    );

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
    <ModalContent hideBody={message === undefined && children === undefined}>
        {#snippet header()}
            {#if title !== undefined}
                <Translatable resourceKey={title} />
            {/if}
        {/snippet}
        {#snippet body()}
            {@render children?.()}
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
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button disabled={inProgress} small onClick={() => onClick(false)} secondary>
                    {#if noLabel !== undefined}
                        <Translatable resourceKey={noLabel} />
                    {/if}
                </Button>
                <Button
                    loading={inProgress}
                    disabled={!canConfirm}
                    small
                    onClick={() => onClick(true)}>
                    {#if yesLabel !== undefined}
                        <Translatable resourceKey={yesLabel} />
                    {/if}
                </Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .challenge {
        margin: $sp3 0;
    }
</style>
