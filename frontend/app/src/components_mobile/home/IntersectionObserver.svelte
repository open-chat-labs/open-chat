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
    let pending = false;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            const context: { node: HTMLElement | undefined } = getContext(contextId);
            const root = context?.node ?? null;
            // capture the element - bind:this nulls `container` on destroy,
            // and the observer callback can fire after that
            const el = container;
            let destroyed = false;
            const observer = new IntersectionObserver(
                (entries) => {
                    if (destroyed) return;
                    entries.sort((a, b) => b.time - a.time);
                    const entry = entries[0];

                    intersecting = entry.isIntersecting;

                    if (intersecting && !pending) {
                        pending = true;

                        // Use rAF to try an push the observer callback to be
                        // called before the next render frame, then prevent the
                        // callback from being called again for the next 80ms.
                        requestAnimationFrame(() => {
                            // destroy may have happened between the observer
                            // callback and this frame — common when the
                            // virtual list recycles rows during a fast scroll
                            if (destroyed) return;

                            onIntersecting?.();

                            if (unobserveOnIntersect) {
                                observer.unobserve(el);
                            }

                            setTimeout(() => {
                                pending = false;
                            }, 80);
                        });
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
            observer.observe(el);
            return () => {
                destroyed = true;
                observer.disconnect();
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
