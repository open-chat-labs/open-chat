<script lang="ts">
    export let underline: boolean = false;
</script>

<a href="/#" class:underline on:click|preventDefault|stopPropagation>
    <slot />
</a>

<style type="text/scss">
    .underline {
        text-decoration: underline;
        text-decoration-color: var(--link-underline);
        text-underline-offset: $sp2;
        cursor: pointer;
        &:hover {
            text-decoration-thickness: 2px;
        }
    }
</style>
