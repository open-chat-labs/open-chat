<script lang="ts">
    import { BodySmall, ColourVars, Container, Subtitle } from "component-lib";
    import { allUsersStore, botState, type ExternalBotLike } from "openchat-client";
    import RobotSolid from "svelte-material-icons/Robot.svelte";
    import BotAvatar from "../../../bots/BotAvatar.svelte";
    import Markdown from "../../Markdown.svelte";

    interface Props {
        bot: ExternalBotLike;
        onSelect: (botId: string) => void;
    }

    let { bot, onSelect }: Props = $props();

    let isPublic = $derived(
        botState.externalBots.get(bot.id)?.registrationStatus?.kind === "public",
    );
    let owner = $derived($allUsersStore.get(bot.ownerId));
</script>

<Container onClick={() => onSelect(bot.id)} padding={["sm", "zero"]} direction={"vertical"}>
    <Container overflow={"hidden"} gap={"md"}>
        <BotAvatar size={"xxl"} {bot}>
            <div class="robot">
                <RobotSolid size={"1rem"} color={ColourVars.textOnPrimary} />
            </div>
        </BotAvatar>
        <Container gap={"xs"} direction={"vertical"}>
            <Container crossAxisAlignment={"center"} gap={"sm"}>
                <div class={`img ${isPublic ? "public" : "private"}`}></div>
                <Subtitle fontWeight={"bold"}>
                    {bot.name}
                </Subtitle>
            </Container>
            <BodySmall colour={"textSecondary"}>
                <Markdown oneLine text={bot.definition.description} />
            </BodySmall>
            {#if owner}
                <Container gap={"xs"}>
                    <BodySmall width={"hug"}>Owned by</BodySmall>
                    <BodySmall width={"hug"} fontWeight={"bold"} colour={"secondary"}>
                        @{owner.username}
                    </BodySmall>
                </Container>
            {/if}
        </Container>
    </Container>
</Container>
