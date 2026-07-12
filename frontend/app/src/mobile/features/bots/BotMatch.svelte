<script lang="ts">
    import { BodySmall, Container, IconButton } from "component-lib";
    import { type ExternalBot } from "@shared";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import FilteredUsername from "@src/ui/FilteredUsername.svelte";
    import Markdown from "@src/ui/Markdown.svelte";
    import BotBadge from "@src/mobile/features/bots/exports/BotBadge.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    interface Props {
        bot: ExternalBot;
        searchTerm?: string;
        onSelect: (bot: ExternalBot) => void;
    }

    let { bot, searchTerm, onSelect }: Props = $props();
</script>

<Container onClick={() => onSelect(bot)} crossAxisAlignment={"start"} gap={"md"}>
    <BotAvatar size={"md"} {bot} />
    <Container overflow={"hidden"} gap={"xxs"} direction={"vertical"} width={"fill"}>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <FilteredUsername {searchTerm} username={bot.name} />
            <BotBadge bot />
        </Container>
        <BodySmall width={"hug"} colour={"textSecondary"}>
            <Markdown twoLine inline={false} suppressLinks text={bot.definition.description} />
        </BodySmall>
    </Container>
    <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
        {#snippet icon(color)}
            <ChevronRight {color} />
        {/snippet}
    </IconButton>
</Container>
