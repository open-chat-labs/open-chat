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

<Overlay dismissible>
    <ModalContent closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={title}></Translatable>
        </div>
        <div class="body" slot="body">
            <AlertBox>
                <Markdown text={interpolate($_, warning)} />
            </AlertBox>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
