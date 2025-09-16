<script lang="ts">
    import { Caption, ColourVars } from "component-lib";
    import Container from "../Container.svelte";
    import type { Reaction } from "./Reactions.svelte";

    interface Props {
        reaction: Reaction;
    }

    let { reaction }: Props = $props();
</script>

<Container
    borderRadius={"lg"}
    padding={["zero", "xs"]}
    backgroundColour={ColourVars.background2}
    crossAxisAlignment={"center"}
    gap={"xs"}
    borderWidth={"thin"}
    borderColour={ColourVars.background0}>
    {reaction.text}
    <Caption>{reaction.usernames.length}</Caption>
</Container>
