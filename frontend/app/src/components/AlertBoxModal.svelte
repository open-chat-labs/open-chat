<script lang="ts">
    import { i18nKey, ui, type ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import AlertBox from "./AlertBox.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Markdown from "./home/Markdown.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "./Translatable.svelte";

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
                    <Button onClick={onClose} small={!ui.mobileWidth} tiny={ui.mobileWidth}>
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
