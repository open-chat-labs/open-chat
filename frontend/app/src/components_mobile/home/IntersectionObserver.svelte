<script lang="ts">
    import { getContext, onMount, type Snippet } from "svelte";

    interface Props {
        unobserveOnIntersect?: boolean;
        children?: Snippet<[boolean]>;
        onIntersecting?: () => void;
        contextId?: string;
        rootMarginTop?: number;
        rootMarginBottom?: number;
    }

    let {
        unobserveOnIntersect = true,
        children,
        onIntersecting,
        contextId,
        rootMarginTop,
        rootMarginBottom,
    }: Props = $props();

    let intersecting = $state(false);
    let container: HTMLElement;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            const context: { node: HTMLElement | undefined } = getContext(contextId);
            const root = context?.node ?? null;
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.sort((a, b) => b.time - a.time);
                    intersecting = entries[0].isIntersecting;
                    if (intersecting) {
                        onIntersecting?.();
                        if (unobserveOnIntersect) {
                            observer.unobserve(container);
                        }
                    }
                },
                {
                    root,
                    rootMargin:
                        rootMarginTop || rootMarginBottom
                            ? `${rootMarginTop ?? 0}px 0px ${rootMarginBottom ?? 0}px 0px`
                            : undefined,
                    threshold: 0,
                },
            );

            observer.observe(container);
            return () => {
                if (container) {
                    observer.unobserve(container);
                }
            };
        }
    });
</script>

<div class="intersection_observer" bind:this={container}>
    {@render children?.(intersecting)}
</div>

<style lang="scss">
    .intersection_observer {
        width: 100%;
    }
</style>
