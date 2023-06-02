<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";
</script>

<span class={`link-button ${underline}`} class:hover={underline === "hover"} on:click>
    <slot />
</span>

<style lang="scss">
    span {
        cursor: pointer;
        color: var(--txt);
        display: inline-block;
    }

    .hover:hover {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }

    .always {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp2;
        text-decoration-thickness: 2px;
    }
</style>
