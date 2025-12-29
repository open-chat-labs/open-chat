<script lang="ts">
    import { ChatText, Column } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        text: ResourceKey;
        failed: boolean;
    }

    let { text, failed }: Props = $props();
</script>

<Column gap={"lg"} padding={"lg"} mainAxisAlignment={"center"}>
    {#if !failed}
        <div class="spinner">
            <FancyLoader />
        </div>
    {/if}
    <ChatText>
        <Translatable resourceKey={text} />
    </ChatText>
</Column>

<style lang="scss">
    .spinner {
        width: 4rem;
        margin: 0 auto;
    }
</style>
