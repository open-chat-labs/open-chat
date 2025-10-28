<script lang="ts">
    import { getAllContexts, mount, onMount, unmount, type Snippet } from "svelte";
    import SheetWrapper from "./SheetWrapper.svelte";

    interface Props {
        onDismiss?: () => void;
        children?: Snippet;
        block?: boolean;
    }

    let { onDismiss, children, block }: Props = $props();

    const context = getAllContexts();
    let mounted: Record<string, any> | undefined = undefined;

    async function internalClose() {
        if (mounted) {
            await mounted.beforeClose();
            unmount(mounted);
            mounted = undefined;
        }
    }

    onMount(() => {
        mounted = mount(SheetWrapper, {
            target: document.body,
            props: {
                children,
                onDismiss,
                block,
            },
            context,
        });
        return internalClose;
    });
</script>
