<script lang="ts">
    import type { ProposalContent } from "../../domain/chat/chat";

    export let content: ProposalContent;
</script>

<pre>
    {JSON.stringify(content, null, 4)}
</pre>

<style type="text/scss">
</style>
