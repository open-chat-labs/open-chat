<script lang="ts">
    export let underline: "never" | "always" | "hover" = "never";
</script>

<span class={`link-button ${underline}`} class:hover={underline === "hover"} on:click>
    <slot />
</span>

<style type="text/scss">
    span {
        cursor: pointer;
        color: var(--link-underline);
        display: inline-block;
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
        text-decoration-thickness: 2px;
    }
</style>
