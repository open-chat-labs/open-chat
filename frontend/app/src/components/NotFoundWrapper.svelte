<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import NotFound from "./NotFound.svelte";

    const dispatch = createEventDispatcher();
</script>

<NotFound onClose={() => dispatch("close")} />
