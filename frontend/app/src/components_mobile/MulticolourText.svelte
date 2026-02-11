<script module lang="ts">
    import type { ColourVarKeys } from "component-lib";
    import { ColourVars } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "./Translatable.svelte";

    export type TextPart = {
        text: ResourceKey;
        colour: ColourVarKeys;
    };
</script>

<script lang="ts">
    interface Props {
        parts: TextPart[];
    }

    let { parts }: Props = $props();
</script>

{#each parts as { text, colour }}
    <span style={`color: ${ColourVars[colour]}`}>
        <Translatable resourceKey={text}></Translatable>
    </span>
{/each}
