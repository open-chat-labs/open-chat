<script lang="ts">
    import { i18nKey, mobileWidth, type ResourceKey } from "@client";
    import { _ } from "svelte-i18n";
    import { interpolate } from "@src/i18n/i18n";
    import AlertBox from "@src/desktop/shared/AlertBox.svelte";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import Markdown from "@src/ui/Markdown.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Overlay from "@src/ui/Overlay.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

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
                    <Button onClick={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
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
