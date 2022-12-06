<script lang="ts">
    import { location } from "svelte-spa-router";
    export let id: string;
</script>

<a href={`/#${$location}?section=${id}`}><slot /></a>
