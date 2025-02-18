<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "openchat-client";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import ShowApiKey from "./ShowApiKey.svelte";

    interface Props {
        apiKey: string;
        onClose: () => void;
    }

    let { apiKey, onClose }: Props = $props();

    function onCopy() {
        navigator.clipboard.writeText(apiKey);
    }
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("bots.manage.generated")}></Translatable>
        </div>
        <div class="body" slot="body">
            <ShowApiKey {apiKey} />
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onCopy}>
                    <Translatable resourceKey={i18nKey("copy")} />
                </Button>
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
