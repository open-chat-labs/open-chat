<script lang="ts">
    export let url: string;
</script>

<a href={url}><slot /></a>

<style lang="scss">
    a {
        color: currentColor;
    }
</style>
