<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    export let unobserveOnIntersect = true;

    const dispatch = createEventDispatcher();

    let intersecting = false;
    let container: HTMLElement;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            const observer = new IntersectionObserver((entries) => {
                entries.sort((a, b) => b.time - a.time);
                intersecting = entries[0].isIntersecting;
                if (intersecting) {
                    dispatch("intersecting");
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
    <slot {intersecting} />
</div>
