<script lang="ts">
    import { location } from "svelte-spa-router";
    export let id: string;

    // TODO - this probably won't work
</script>

<a href={`${$location}#${id}`}><slot /></a>
