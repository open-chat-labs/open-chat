<script lang="ts">
    import { transition } from "component-lib";
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
    let mounted: Record<string, any> | undefined = undefined;
    let unmounting = $state(false);

    async function internalClose() {
        console.log("Is this happening twice", mounted, unmounting);
        if (mounted && !unmounting) {
            unmounting = true;
            await transition(["modal_sheet_out"], async () => {
                if (mounted) {
                    await unmount(mounted, { outro: true });
                    mounted = undefined;
                    unmounting = false;
                }
            });
            onClose?.();
        }
    }

    onMount(() => {
        transition(["modal_sheet_in"], () => {
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
        });
        return async () => internalClose();
    });
</script>
