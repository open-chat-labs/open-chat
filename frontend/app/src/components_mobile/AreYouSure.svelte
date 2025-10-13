<script lang="ts">
    import { Body, CommonButton, Container, Input, Sheet, Title } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import Markdown from "./home/Markdown.svelte";
    import Translatable from "./Translatable.svelte";

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

<Sheet onClose={() => action(false)}>
    {#snippet sheet()}
        <Container height={{ kind: "hug" }} padding={"xl"} gap={"xl"} direction={"vertical"}>
            {#if title !== undefined}
                <Title fontWeight={"bold"}>
                    <Translatable resourceKey={title} />
                </Title>
            {/if}

            {@render children?.()}

            {#if message !== undefined}
                <Body>
                    <Markdown inline={false} text={interpolate($_, message)} />
                </Body>

                {#if doubleCheck !== undefined}
                    <p class="challenge">
                        <Markdown text={interpolate($_, doubleCheck.challenge)} />
                    </p>
                    <Input
                        disabled={inProgress}
                        bind:value={response}
                        minlength={0}
                        maxlength={200}
                        countdown={false} />
                {/if}
            {/if}

            <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
                <CommonButton disabled={inProgress} onClick={() => onClick(false)} size={"medium"}>
                    {#snippet icon(color)}
                        <Close {color} />
                    {/snippet}
                    {#if noLabel !== undefined}
                        <Translatable resourceKey={noLabel} />
                    {/if}
                </CommonButton>
                <CommonButton
                    loading={inProgress}
                    disabled={!canConfirm}
                    mode={"active"}
                    onClick={() => onClick(true)}
                    size={"medium"}>
                    {#snippet icon(color)}
                        <Check {color} />
                    {/snippet}
                    {#if yesLabel !== undefined}
                        <Translatable resourceKey={yesLabel} />
                    {/if}
                </CommonButton>
            </Container>
        </Container>
    {/snippet}
</Sheet>
