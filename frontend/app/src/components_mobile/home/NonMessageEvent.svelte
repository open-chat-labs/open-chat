<script lang="ts">
    import { Caption, Container } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        text: string;
        timestamp: bigint;
    }

    let { text, timestamp }: Props = $props();
    let date = $derived(new Date(Number(timestamp)));
</script>

<Container padding={"sm"} crossAxisAlignment={"center"} direction={"vertical"}>
    <Caption width={{ kind: "hug" }} colour={"textSecondary"}>
        <Markdown suppressLinks {text} />
    </Caption>
    <Caption width={{ kind: "hug" }} colour={"textSecondary"}>
        {`${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`}
    </Caption>
</Container>
