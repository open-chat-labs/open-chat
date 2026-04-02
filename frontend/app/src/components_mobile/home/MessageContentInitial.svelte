<script lang="ts">
    import { ChatText, Column, ColourVars, Row } from "component-lib";
    import { type ResourceKey } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Translatable from "../Translatable.svelte";
    import TextContent from "./TextContent.svelte";

    interface Props {
        text: ResourceKey;
        failed: boolean;
    }

    let { text, failed }: Props = $props();
</script>

<Column padding={"zero"} maxWidth="70vw" mainAxisAlignment={"center"}>
    {#if !failed}
        <Row
            padding="md"
            borderRadius={["lg", "md", "md", "md"]}
            backgroundColor={ColourVars.background2}>
            <div class="spinner">
                <FancyLoader />
            </div>
        </Row>
    {/if}
    <Row>
        <TextContent me fill={false} edited={false} showPreviews={false} blockLevelMarkdown={false}>
            {#snippet content()}
                <ChatText italic={true}>
                    <Translatable resourceKey={text} />
                </ChatText>
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
