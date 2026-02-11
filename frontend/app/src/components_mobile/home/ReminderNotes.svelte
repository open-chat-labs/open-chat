<script lang="ts">
    import { ChatText } from "component-lib";
    import Markdown from "./Markdown.svelte";

    interface Props {
        notes: string | undefined;
    }

    let { notes }: Props = $props();
</script>

{#if notes !== undefined && notes !== ""}
    <ChatText fontWeight={"bold"}>
        <Markdown inline suppressLinks text={notes} />
    </ChatText>
{/if}
