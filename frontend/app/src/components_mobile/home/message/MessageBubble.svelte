<script lang="ts">
    import { ColourVars, Container, type Padding, type Radius } from "component-lib";
    import type { Snippet } from "svelte";
    import MessageMetadata from "./MessageMetadata.svelte";

    interface Props {
        me?: boolean;
        messageContent?: Snippet<[boolean]>;
        hasThread?: boolean;
        hasReactions?: boolean;
        time: number;
        edited: boolean;
        first: boolean;
        last: boolean;
    }

    let {
        me = false,
        messageContent,
        time,
        hasThread = false,
        hasReactions = false,
        edited,
        first,
        last,
    }: Props = $props();

    let backgroundColour = $derived(me ? ColourVars.primary : ColourVars.background2);
    let padding = $derived<Padding>(
        hasReactions && !hasThread ? ["sm", "md"] : ["sm", "md", "xxs", "md"],
    );

    let borderRadius = $derived.by<Radius>(() => {
        // top, right, bottom, left
        if (me) {
            return ["xl", "sm", hasThread || !last ? "sm" : "xl", "xl"];
        } else {
            return ["sm", "xl", "xl", hasThread || !last ? "sm" : "xl"];
        }
    });
</script>

<Container
    direction={"vertical"}
    {borderRadius}
    {padding}
    gap={"xs"}
    width={{ kind: "hug" }}
    background={backgroundColour}>
    {@render messageContent?.(me)}
    <MessageMetadata {edited} {time}></MessageMetadata>
</Container>
