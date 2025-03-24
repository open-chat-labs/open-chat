<script lang="ts">
    import type { Feature } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";

    interface Props {
        feature: Feature;
        onClose: () => void;
    }

    let { feature, onClose }: Props = $props();
</script>

<ModalContent>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("restricted.title")} />
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if feature === "swap"}
                <Translatable resourceKey={i18nKey("restricted.swap")} />
            {:else}
                <Translatable resourceKey={i18nKey("restricted.generic")} />
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <ButtonGroup>
            <Button on:click={onClose}><Translatable resourceKey={i18nKey("close")} /></Button>
        </ButtonGroup>
    {/snippet}
</ModalContent>
