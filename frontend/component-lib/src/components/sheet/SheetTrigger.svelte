<script lang="ts">
    import { portalState } from "component-lib";
    import { getAllContexts, mount, type Snippet } from "svelte";
    import Sheet from "./Sheet.svelte";

    interface Props {
        trigger: Snippet<[(e?: MouseEvent | TouchEvent) => void]>;
        sheet: Snippet<[() => void]>;
    }

    let { trigger, sheet }: Props = $props();

    let open = $state(false);
    const context = getAllContexts();

    function toggle(e?: MouseEvent | TouchEvent) {
        e?.preventDefault();
        e?.stopPropagation();

        if (open) {
            closeSheet();
        } else {
            openSheet();
        }
    }

    export function openSheet() {
        open = portalState.open(
            mount(Sheet, {
                target: document.body,
                props: {
                    sheet: sheet,
                    onClose: closeSheet,
                },
                context,
            }),
        );
    }

    function closeSheet() {
        open = portalState.close();
    }
</script>

{@render trigger(toggle)}
