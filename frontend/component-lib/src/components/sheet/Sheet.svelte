<script lang="ts" module>
    export type SheetState<T> =
        | {
              data: T;
              visible: true;
          }
        | { data?: T; visible: false };
</script>

<script lang="ts">
    import { transition } from "component-lib";
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

    function internalClose() {
        if (mounted) {
            transition(["modal_sheet"], () => {
                if (mounted) {
                    unmount(mounted);
                    mounted = undefined;
                }
            });
        }
    }

    onMount(() => {
        transition(["modal_sheet"], () => {
            mounted = mount(SheetWrapper, {
                target: document.body,
                props: {
                    children,
                    onDismiss,
                    block,
                },
                context,
            });
        });
        return internalClose;
    });
</script>
