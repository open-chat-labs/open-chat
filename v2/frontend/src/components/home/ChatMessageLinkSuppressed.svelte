<script lang="ts">
    export let title: string | undefined = undefined;
</script>

<style type="text/scss">
    span {
        text-decoration: underline;
    }
</style>

<span {title}><slot /></span>
