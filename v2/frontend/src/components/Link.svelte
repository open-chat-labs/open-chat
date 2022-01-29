<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";
    export let anchor: HTMLAnchorElement | undefined = undefined;
</script>

<a
    bind:this={anchor}
    role="button"
    href="/#"
    class={underline}
    class:hover={underline === "hover"}
    on:click|preventDefault|stopPropagation>
    <slot />
</a>

<style type="text/scss">
    a {
        cursor: pointer;
    }

    .hover:hover {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        &:hover {
            text-decoration-thickness: 2px;
        }
    }
</style>
