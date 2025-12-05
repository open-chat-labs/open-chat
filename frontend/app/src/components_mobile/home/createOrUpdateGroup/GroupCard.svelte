<script lang="ts">
    import type { ColourVarKeys } from "component-lib";
    import { Avatar, BodySmall, ColourVars, Container, Rem, Subtitle } from "component-lib";
    import type { CandidateGroupChat, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup: CandidateGroupChat;
    }

    let { candidateGroup }: Props = $props();

    type Fragment = {
        text: string;
        colour: ColourVarKeys;
    };

    let fragments = $derived.by<Fragment[]>(() => {
        const parts: Fragment[] = [];
        parts.push({
            text: candidateGroup.historyVisible ? "Chat history visible" : "No chat history",
            colour: "textSecondary",
        });
        parts.push({ text: " // ", colour: "textPrimary" });
        parts.push({
            text:
                candidateGroup.eventsTTL === undefined
                    ? "Disappearing messages "
                    : "Messages disappear after ",
            colour: "textSecondary",
        });
        parts.push({
            text:
                candidateGroup.eventsTTL === undefined
                    ? "disabled"
                    : client.formatDuration(Number(candidateGroup.eventsTTL)),
            colour: "warning",
        });
        parts.push({ text: " // ", colour: "textPrimary" });
        parts.push({ text: "Rules", colour: "textSecondary" });
        parts.push({
            text: candidateGroup.rules.enabled ? "enabled" : "disabled",
            colour: "secondary",
        });
        return parts;
    });
</script>

<Container
    crossAxisAlignment={"center"}
    gap={"lg"}
    background={ColourVars.background1}
    borderRadius={"lg"}
    padding={"lg"}>
    <Avatar
        customSize={Rem.fromPixels(64).toString()}
        highlightBorder
        url={candidateGroup.avatar?.blobUrl ?? "/assets/group.svg"} />
    <Container direction={"vertical"} gap={"sm"}>
        <Subtitle fontWeight={"bold"}>{candidateGroup.name}</Subtitle>
        <Container gap={"xs"} supplementalClass="group_card_features" wrap>
            {#each fragments as { text, colour }}
                <BodySmall width={"hug"} {colour}>
                    {text}
                </BodySmall>
            {/each}
        </Container>
    </Container>
</Container>

<style lang="scss">
    :global(.container.group_card_features) {
        row-gap: 0 !important;
    }
</style>
