<script lang="ts">
    import { BodySmall, Button, Subtitle } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import SparkleBoxOutline from "./SparkleBoxOutline.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        title: Snippet;
        body?: Snippet;
        onClick: () => void;
        buttonIcon: Snippet<[string]>;
        buttonText: ResourceKey;
    }

    let { title, body, onClick, buttonIcon, buttonText }: Props = $props();
</script>

<SparkleBoxOutline>
    <Subtitle fontWeight={"bold"} colour={"primaryLight"}>
        {@render title()}
    </Subtitle>

    {#if body}
        <BodySmall colour={"primaryLight"}>
            {@render body()}
        </BodySmall>
    {/if}

    <Button {onClick} icon={buttonIcon}>
        <Translatable resourceKey={buttonText}></Translatable>
    </Button>
</SparkleBoxOutline>
