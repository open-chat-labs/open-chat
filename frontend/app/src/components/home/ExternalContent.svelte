<script lang="ts">
    export let externalUrl: string;
</script>

<iframe src={externalUrl} />

<style lang="scss">
    iframe {
        height: 100%;
        width: 100%;
    }
</style>
