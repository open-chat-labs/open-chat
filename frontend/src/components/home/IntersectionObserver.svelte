<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    const dispatch = createEventDispatcher();

    let intersecting = false;
    let container: HTMLElement;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            const observer = new IntersectionObserver((entries) => {
                intersecting = entries[0].isIntersecting;
                if (intersecting) {
                    dispatch("intersecting");
                    observer.unobserve(container);
                }
            });

            observer.observe(container);
            return () => observer.unobserve(container);
        }
    });
</script>

<div bind:this={container}>
    <slot {intersecting} />
</div>
