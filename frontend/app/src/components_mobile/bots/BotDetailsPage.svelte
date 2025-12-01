<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        Container,
        defaultBackgroundGradient,
        H2,
        IconButton,
        ReadMore,
        Subtitle,
        type SizeMode,
    } from "component-lib";
    import {
        allUsersStore,
        definitionToPermissions,
        publish,
        type ChatSummary,
        type CommunitySummary,
        type ExternalBot,
    } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Calendar from "svelte-material-icons/CalendarMonthOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Installs from "svelte-material-icons/CloudDownloadOutline.svelte";
    import ThumbUp from "svelte-material-icons/ThumbUpOutline.svelte";
    import Markdown from "../home/Markdown.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MulticolourText from "../MulticolourText.svelte";
    import Translatable from "../Translatable.svelte";
    import BotCommands from "./BotCommands.svelte";

    /**
     * This page will be used for displaying the details of an individual bot
     * We *might* be able to use this for register bot as well - not sure yet.
     * Not that the bot may or may not be installed when we use this page.
     */

    interface Props {
        bot: ExternalBot;
        collection?: ChatSummary | CommunitySummary;
    }

    let { bot, collection }: Props = $props();

    let permissions = $derived(definitionToPermissions(bot.definition));
    let owner = $derived($allUsersStore.get(bot.ownerId));
    let collectionName = $derived.by(() => {
        if (collection === undefined) return undefined;
        switch (collection.kind) {
            case "direct_chat":
                return $allUsersStore.get(collection.id.userId)?.username;
            default:
                return collection.name;
        }
    });
    const hug: SizeMode = { kind: "hug" };

    function likeBot() {
        console.log("Like bot");
    }

    function tipBot() {
        console.log("tip bot");
    }

    function installBot() {
        console.log("Install to ", location);
    }
</script>

{#snippet metaDatum(title: string, Icon: any, label: string)}
    <Container
        crossAxisAlignment={"center"}
        mainAxisAlignment={"center"}
        width={hug}
        direction={"vertical"}>
        <Subtitle width={hug} fontWeight={"bold"}>{title}</Subtitle>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <Icon color={ColourVars.primary} />
            <Body width={hug} colour={"textSecondary"}>
                {label}
            </Body>
        </Container>
    </Container>
{/snippet}

<Container
    closeMenuOnScroll
    background={ColourVars.background0}
    padding={"lg"}
    gap={"xxl"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container
        borderRadius={"md"}
        supplementalClass={"bot_background_gradient"}
        minHeight={"7rem"}
        mainAxisAlignment={"end"}
        padding={"sm"}
        gap={"sm"}
        background={defaultBackgroundGradient}>
        <IconButton onclick={() => publish("closeModalPage")} size={"md"} mode={"dark"}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
        </IconButton>
        <IconButton onclick={likeBot} size={"md"} mode={"dark"}>
            {#snippet icon(color)}
                <ThumbUp {color} />
            {/snippet}
        </IconButton>
        <IconButton onclick={tipBot} size={"md"} mode={"dark"}>
            {#snippet icon(color)}
                <Bitcoin {color} />
            {/snippet}
        </IconButton>
    </Container>
    <Container
        supplementalClass={"bot_avatar_and_name"}
        gap={"xl"}
        padding={["zero", "lg"]}
        direction="vertical">
        <Container gap={"xs"}>
            <Avatar
                borderWidth={"extra-thick"}
                size={"xxl"}
                url={bot.avatarUrl ?? "/assets/bot_avatar.svg"}></Avatar>
            <Container crossAxisSelfAlignment={"end"} direction={"vertical"}>
                <H2 fontWeight={"bold"}>{bot.name}</H2>
                <Container gap={"xs"}>
                    <BodySmall width={{ kind: "hug" }} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Owned by")} />
                    </BodySmall>
                    <BodySmall width={{ kind: "hug" }} colour={"primary"}>
                        {`@${owner?.username}`}
                    </BodySmall>
                </Container>
            </Container>
        </Container>
    </Container>
    <Container gap={"xxl"} mainAxisAlignment={"center"} crossAxisAlignment={"center"}>
        {@render metaDatum("Nov 2021", Calendar, "added")}
        <div class="separator"></div>
        {@render metaDatum("584", Installs, "installs")}
        <div class="separator"></div>
        {@render metaDatum("124", ThumbUp, "likes")}
    </Container>
    <Caption colour={"textSecondary"} align={"center"}
        >TODO - none of the above stats are real</Caption>

    <Container gap={"sm"} padding={["zero", "md"]} direction={"vertical"}>
        <Button onClick={installBot}>
            {#snippet icon(color)}
                <ChevronRight {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Proceed to installation")} />
        </Button>
        <BodySmall align={"center"} colour={"textSecondary"}>
            {#if collectionName !== undefined}
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(
                                "By pressing the above button, you will proceed to configure this bot to be installed into the ",
                            ),
                            colour: "textSecondary",
                        },
                        {
                            text: i18nKey(collectionName),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" location."),
                            colour: "textSecondary",
                        },
                    ]}>
                </MulticolourText>
            {:else}
                <Translatable
                    resourceKey={i18nKey(`Choose a location in which to install this bot.`)} />
            {/if}
        </BodySmall>
    </Container>

    <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
        <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Description")} />
        </BodySmall>
        <ReadMore>
            <Body>
                <Markdown inline={false} text={bot.definition.description} />
            </Body>
        </ReadMore>
    </Container>

    <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
        <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Commands")} />
        </BodySmall>
        <BotCommands commands={bot.definition.commands} />
    </Container>

    <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
        <pre>{JSON.stringify(permissions, null, 4)}</pre>
    </Container>
</Container>

<style lang="scss">
    :global(.container.bot_background_gradient > .icon_button:first-child) {
        margin-inline-end: auto;
    }

    :global(.container.bot_avatar_and_name) {
        margin-top: -3.5rem;
    }
    .separator {
        height: 2rem;
        width: toRem(4);
        background-color: var(--background-2);
    }
</style>
