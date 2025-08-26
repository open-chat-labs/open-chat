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
            const observer = new IntersectionObserver((entries) => {
                entries.sort((a, b) => b.time - a.time);
                intersecting = entries[0].isIntersecting;
                if (intersecting) {
                    onIntersecting?.();
                    if (unobserveOnIntersect) {
                        observer.unobserve(container);
                    }
                }
            });

            observer.observe(container);
            return () => {
                if (container) {
                    observer.unobserve(container);
                }
            };
        }
    });
</script>

<div bind:this={container}>
    {@render children?.(intersecting)}
</div>
