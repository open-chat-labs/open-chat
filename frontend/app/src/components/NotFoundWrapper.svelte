<script module lang="ts">
    export type NotFoundType = Component<{ showLandingPage: boolean }>;
</script>

<script lang="ts">
    import { createEventDispatcher, type Component } from "svelte";
    import NotFound from "./NotFound.svelte";

    const dispatch = createEventDispatcher();
</script>

<NotFound onClose={() => dispatch("close")} />
