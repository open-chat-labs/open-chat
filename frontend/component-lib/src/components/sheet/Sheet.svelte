<script lang="ts">
    import { getAllContexts, mount, onMount, unmount, type Snippet } from "svelte";
    import SheetWrapper from "./SheetWrapper.svelte";

    interface Props {
        onDismiss?: () => void;
        children?: Snippet;
    }

    let { onDismiss, children }: Props = $props();

    const context = getAllContexts();
    let mounted: Record<string, any> | undefined = undefined;

    async function internalClose() {
        if (mounted) {
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
            },
            context,
        });
        return internalClose;
    });
</script>
