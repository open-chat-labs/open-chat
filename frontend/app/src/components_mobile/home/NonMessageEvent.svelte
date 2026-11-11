<script lang="ts">
    import { Caption, Container } from "component-lib";
    import { toLongDatetimeString } from "@client";
    import { locale } from "svelte-i18n";
    import Markdown from "@src/core/Markdown.svelte";

    interface Props {
        text: string;
        timestamp: bigint;
    }

    let { text, timestamp }: Props = $props();
    let date = $derived(new Date(Number(timestamp)));
</script>

<Container padding={"sm"} crossAxisAlignment={"center"} direction={"vertical"}>
    <Caption width={"hug"} colour={"textSecondary"}>
        <Markdown suppressLinks {text} />
    </Caption>
    <Caption width={"hug"} colour={"textSecondary"}>
        {toLongDatetimeString(date, $locale ?? "en")}
    </Caption>
</Container>
