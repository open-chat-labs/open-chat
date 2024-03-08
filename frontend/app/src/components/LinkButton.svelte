<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";
    export let light = false;
</script>

<span
    class={`link-button ${underline}`}
    class:hover={underline === "hover"}
    class:light
    on:click|stopPropagation>
    <slot />
</span>

<style lang="scss">
    span {
        cursor: pointer;
        color: var(--txt);
        display: inline-block;

        &.light {
            color: var(--txt-light);
        }
    }

    @media (hover: hover) {
        .hover:hover {
            text-decoration: underline;
            text-decoration-color: var(--accent);
            text-underline-offset: $sp2;
            text-decoration-thickness: 2px;
        }
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }
</style>
