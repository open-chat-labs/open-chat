<script lang="ts">
    import { getAllContexts, mount, onMount, unmount, type Snippet } from "svelte";
    import SheetWrapper from "./SheetWrapper.svelte";

    interface Props {
        dismissible?: boolean;
        children?: Snippet;
        onClose?: () => void;
        block?: boolean;
    }

    let { dismissible, children, onClose, block }: Props = $props();

    const context = getAllContexts();
    let mounted: Record<string, any> | undefined;

    function internalClose() {
        if (mounted) {
            unmount(mounted);
        }
        onClose?.();
    }

    onMount(() => {
        mounted = mount(SheetWrapper, {
            target: document.body,
            props: {
                children,
                onClose: internalClose,
                dismissible,
                block,
            },
            context,
        });

        return () => internalClose();
    });
</script>
