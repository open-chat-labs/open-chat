<script lang="ts">
    import type { Snippet } from "svelte";
    import ModalContent from "../../ModalContent.svelte";
    interface Props {
        children?: Snippet;
        onClose?: () => void;
    }

    let { children, onClose }: Props = $props();
</script>

<ModalContent {onClose} hideHeader hideFooter fadeDelay={0} fadeDuration={0}>
    {#snippet body()}
        <div>
            {@render children?.()}
        </div>
    {/snippet}
</ModalContent>
