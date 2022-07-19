<script lang="ts">
    export let title: string | null;
    export let text: string;
</script>

<span class="fake-link" {title}>{text}</span>

<style type="text/scss">
    .fake-link {
        text-decoration: none;
    }
</style>
