<script lang="ts">
    import { onMount } from "svelte";

    let intersecting = false;
    let container: HTMLElement;

    onMount(() => {
        if (typeof IntersectionObserver !== "undefined") {
            const observer = new IntersectionObserver((entries) => {
                intersecting = entries[0].isIntersecting;
                if (intersecting) {
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
