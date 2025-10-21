<script lang="ts">
    import { Caption, ColourVars, Container } from "component-lib";
    import type { CustomEmoji, Reaction } from "openchat-client";
    import { currentUserIdStore, customEmojis } from "openchat-client";

    // TODO - add tooltip popup to this

    interface Props {
        reaction: Reaction;
        intersecting: boolean;
        onClick: (r: Reaction) => void;
    }

    let { reaction, intersecting, onClick }: Props = $props();
    let customEmoji = $state(getCustomEmoji(reaction.reaction));
    let selected = $derived(reaction.userIds.has($currentUserIdStore));

    function getCustomEmoji(reaction: string): CustomEmoji | undefined {
        const match = reaction.match(/^@(?:CustomEmoji|CE)\(([\w-]+)\)$/);
        const code = match ? match[1] : undefined;
        return code ? customEmojis.get(code) : undefined;
    }
</script>

<Container
    onClick={() => onClick(reaction)}
    borderRadius={"lg"}
    width={{ kind: "hug" }}
    padding={["zero", "xs"]}
    background={selected ? ColourVars.disabledButton : ColourVars.background2}
    crossAxisAlignment={"center"}
    gap={"xs"}
    borderWidth={"thin"}
    borderColour={ColourVars.background0}>
    {#if customEmoji !== undefined}
        {#if intersecting}
            <custom-emoji data-id={customEmoji.code}></custom-emoji>
        {:else}
            ...
        {/if}
    {:else}
        {reaction.reaction}
    {/if}
    <Caption>
        {reaction.userIds.size > 999 ? "999+" : reaction.userIds.size}
    </Caption>
</Container>
