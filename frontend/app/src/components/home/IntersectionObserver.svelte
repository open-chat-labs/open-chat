<script lang="ts">
    import { onMount, type Snippet } from "svelte";
    import { observeIntersection } from "../../utils/sharedIntersectionObserver";

    interface Props {
        unobserveOnIntersect?: boolean;
        children?: Snippet<[boolean]>;
        onIntersecting?: () => void;
    }

    let { unobserveOnIntersect = true, children, onIntersecting }: Props = $props();

    let intersecting = $state(false);
    let container: HTMLElement;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            // capture the element - bind:this nulls `container` on destroy,
            // and the observer callback can fire after that
            const el = container;
            const unobserve = observeIntersection(el, (entry) => {
                intersecting = entry.isIntersecting;
                if (intersecting) {
                    onIntersecting?.();
                    if (unobserveOnIntersect) {
                        unobserve();
                    }
                }
            });

            return unobserve;
        }
    });
</script>

<div bind:this={container}>
    {@render children?.(intersecting)}
</div>
