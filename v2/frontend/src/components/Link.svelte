<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";
</script>

<a
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
        text-decoration-color: var(--link-underline);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--link-underline);
        text-underline-offset: $sp2;
        &:hover {
            text-decoration-thickness: 2px;
        }
    }
</style>
