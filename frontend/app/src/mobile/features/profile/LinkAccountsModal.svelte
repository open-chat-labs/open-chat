<script lang="ts">
    import { Column, Sheet } from "component-lib";
    import type { Snippet } from "svelte";
    interface Props {
        children?: Snippet;
        onClose?: () => void;
    }

    let { children, onClose }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <Column padding={"xl"}>
        {@render children?.()}
    </Column>
</Sheet>
