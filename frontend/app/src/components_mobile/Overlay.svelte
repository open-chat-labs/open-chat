<script lang="ts">
    import { getAllContexts, mount, onMount, unmount, type Snippet } from "svelte";
    import OverlayWrapper from "./portal/OverlayWrapper.svelte";

    interface Props {
        fade?: boolean;
        alignBottomOnMobile?: boolean;
        dismissible?: boolean;
        alignLeft?: boolean;
        children?: Snippet;
        onClose?: () => void;
    }

    let { children, onClose, ...rest }: Props = $props();

    const context = getAllContexts();
    let mounted: Record<string, any> | undefined;

    function internalClose() {
        if (mounted) {
            unmount(mounted);
        }
        onClose?.();
    }

    onMount(() => {
        mounted = mount(OverlayWrapper, {
            target: document.body,
            props: {
                children: children,
                onClose: internalClose,
                ...rest,
            },
            context,
        });

        return () => internalClose();
    });
</script>
