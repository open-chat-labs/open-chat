<script lang="ts">
    import type { Feature } from "@client";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import Button from "@src/ui/Button.svelte";

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
            <Button onClick={onClose}><Translatable resourceKey={i18nKey("close")} /></Button>
        </ButtonGroup>
    {/snippet}
</ModalContent>
