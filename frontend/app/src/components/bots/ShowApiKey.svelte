<script lang="ts">
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import AlertBox from "../AlertBox.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "openchat-client";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";

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
            <Translatable resourceKey={i18nKey("Api key generated")}></Translatable>
        </div>
        <div class="body" slot="body">
            <div class="key">
                <pre>{apiKey}</pre>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div role="button" tabindex="0" onclick={onCopy} class="copy">
                    <CopyIcon size={"1rem"} color={"var(--icon-txt)"} />
                </div>
            </div>
            <AlertBox>
                <Translatable
                    resourceKey={i18nKey("Keep this key secret because it's important ok?")}
                ></Translatable>
            </AlertBox>
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

    .copy {
        cursor: pointer;
        transition: transform 0.2s ease;

        &:active {
            transform: scale(0.9);
        }
    }

    .key {
        display: flex;
        gap: $sp2;
        align-items: center;
    }
</style>
