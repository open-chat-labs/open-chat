<script lang="ts">
    import { ColourVars, Container, type Padding, type Radius } from "component-lib";
    import type { Snippet } from "svelte";
    import MessageMetadata from "./MessageMetadata.svelte";

    interface Props {
        me?: boolean;
        messageContent?: Snippet<[boolean]>;
        hasThread?: boolean;
        hasReactions?: boolean;
        messageSubtext?: Snippet;
        time: number;
        edited: boolean;
    }

    let {
        me = false,
        messageContent,
        time,
        hasThread = false,
        hasReactions = false,
        messageSubtext,
        edited,
    }: Props = $props();

    let backgroundColour = $derived(me ? ColourVars.primary : ColourVars.background2);
    let padding = $derived<Padding>(
        hasReactions && !hasThread ? ["sm", "md"] : ["sm", "md", "xxs", "md"],
    );

    // combination of xl & sm
    let borderRadius = $derived<Radius>(
        me
            ? ["xl", "sm", hasThread ? "sm" : "xl", "xl"]
            : ["sm", "xl", "xl", hasThread ? "sm" : "xl"],
    ); // TODO this probably also needs to account for message groups - will come back to that
</script>

<Container
    direction={"vertical"}
    {borderRadius}
    {padding}
    gap={"xs"}
    width={{ kind: "hug" }}
    {backgroundColour}>
    {@render messageContent?.(me)}
    <MessageMetadata {edited} {time}></MessageMetadata>
</Container>
