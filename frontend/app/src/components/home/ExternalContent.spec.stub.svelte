<script lang="ts">
    let { resourceKey }: { resourceKey: { key: string } } = $props();
</script>

<span>{resourceKey.key}</span>
