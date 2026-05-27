<script lang="ts">
    import { ChatCaption, Column, ColourVars, Row, Spinner } from "component-lib";
    import { type ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import TextContent from "./TextContent.svelte";

    interface Props {
        text: ResourceKey;
        failed: boolean;
    }

    let { text, failed }: Props = $props();
</script>

<Column padding={"zero"} maxWidth="70vw" mainAxisAlignment={"center"}>
    <Row>
        {#if !failed}
            <Row width="hug" height="fill" padding={["xs", "md"]} crossAxisAlignment="center">
                <Spinner
                    size="1.5rem"
                    backgroundColour={ColourVars.primary}
                    foregroundColour={ColourVars.background1} />
            </Row>
        {/if}
        <TextContent me>
            {#snippet content()}
                <ChatCaption colour={failed ? "error" : "textSecondary"}>
                    <Translatable resourceKey={text} />
                </ChatCaption>
            {/snippet}
        </TextContent>
    </Row>
</Column>

<style lang="scss">
    .spinner {
        width: 4rem;
        margin: 0 auto;
    }
</style>
