<script lang="ts">
    import { onMount, type Snippet } from "svelte";

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
            let destroyed = false;
            const observer = new IntersectionObserver((entries) => {
                if (destroyed) return;
                entries.sort((a, b) => b.time - a.time);
                intersecting = entries[0].isIntersecting;
                if (intersecting) {
                    onIntersecting?.();
                    if (unobserveOnIntersect) {
                        observer.unobserve(el);
                    }
                }
            });

            observer.observe(el);
            return () => {
                destroyed = true;
                observer.disconnect();
            };
        }
    });
</script>

<div bind:this={container}>
    {@render children?.(intersecting)}
</div>
