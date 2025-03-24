<script lang="ts">
    import { _ } from "svelte-i18n";
    import AlertBox from "./AlertBox.svelte";
    import Overlay from "./Overlay.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey, type ResourceKey } from "openchat-client";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Button from "./Button.svelte";
    import { mobileWidth } from "../stores/screenDimensions";
    import { interpolate } from "../i18n/i18n";
    import Markdown from "./home/Markdown.svelte";

    interface Props {
        title: ResourceKey;
        warning: ResourceKey;
        onClose: () => void;
    }

    let { onClose, title, warning }: Props = $props();
</script>

<Overlay {onClose} dismissible>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <div class="header">
                <Translatable resourceKey={title}></Translatable>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                <AlertBox>
                    <Markdown text={interpolate($_, warning)} />
                </AlertBox>
            </div>
        {/snippet}
        {#snippet footer()}
            <div class="footer">
                <ButtonGroup>
                    <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                </ButtonGroup>
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
