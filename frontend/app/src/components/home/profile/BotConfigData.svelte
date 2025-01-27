<script lang="ts">
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import type { BotClientConfigData } from "openchat-client";
    import Legend from "../../Legend.svelte";

    interface Props {
        data: BotClientConfigData;
        onClose: () => void;
    }

    let { data, onClose }: Props = $props();

    function onCopy(txt: string) {
        navigator.clipboard.writeText(txt);
    }
</script>

{#snippet copy(txt: string)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div role="button" tabindex="0" onclick={() => onCopy(txt)} class="copy">
        <CopyIcon size={"1rem"} color={"var(--icon-txt)"} />
    </div>
{/snippet}

<Overlay>
    <ModalContent>
        <span slot="header">
            <Translatable resourceKey={i18nKey("bots.config.title")} />
        </span>
        <span slot="body">
            <div class="field">
                <div class="label">
                    <Legend label={i18nKey("OpenChat public key")}></Legend>
                    {@render copy(data.ocPublicKey)}
                </div>
                <pre>{data.ocPublicKey}</pre>
            </div>
            <div class="field">
                <div class="label">
                    <Legend label={i18nKey("OpenStorage index canister")}></Legend>
                    {@render copy(data.openStorageIndexCanister)}
                </div>
                <pre>{data.openStorageIndexCanister}</pre>
            </div>
            <div class="field">
                <div class="label">
                    <Legend label={i18nKey("IC Host Url")}></Legend>
                    {@render copy(data.icHost)}
                </div>
                <pre>{data.icHost}</pre>
            </div>
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button on:click={onClose}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .field {
        margin-bottom: $sp3;
    }

    .copy {
        cursor: pointer;
        transition: transform 0.2s ease;

        &:active {
            transform: scale(0.9);
        }
    }

    .label {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    pre {
        @include font(light, normal, fs-70);
    }
</style>
