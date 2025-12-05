<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        CommonButton,
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
        botIsInstallable,
        definitionToPermissions,
        installationLocationFrom,
        OpenChat,
        publish,
        type BotChatPermission,
        type BotCommunityPermission,
        type ChatSummary,
        type CommunitySummary,
        type ExternalBot,
        type ExternalBotPermissions,
        type GrantedBotPermissions,
        type MessagePermission,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Calendar from "svelte-material-icons/CalendarMonthOutline.svelte";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Installs from "svelte-material-icons/CloudDownloadOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import ThumbUp from "svelte-material-icons/ThumbUpOutline.svelte";
    import Markdown from "../home/Markdown.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MulticolourText from "../MulticolourText.svelte";
    import Translatable from "../Translatable.svelte";
    import BotCommands from "./BotCommands.svelte";
    import BotsPermissionInfo from "./BotsPermissionInfo.svelte";
    import OwnedLocationSelector from "./OwnedLocationSelector.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        bot: ExternalBot;
        collection?: ChatSummary | CommunitySummary;
        grantedPermissions?: GrantedBotPermissions; // this will be set if the bot is already installed
    }

    let { bot, collection = $bindable(), grantedPermissions }: Props = $props();

    let canManageBots = $derived(
        collection !== undefined ? client.canManageBots(collection.id) : true,
    );
    let busy = $state(false);
    let isPublic = $derived(bot.registrationStatus.kind === "public");
    let location = $derived(collection ? installationLocationFrom(collection) : undefined);
    let installableHere = $derived(location !== undefined && botIsInstallable(bot, location));
    let selectInstallationLocation = $state(false);
    let requestedPermissions = $derived(definitionToPermissions(bot.definition));
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
    const hug: SizeMode = "hug";

    function likeBot() {
        console.log("Like bot");
    }

    function tipBot() {
        console.log("tip bot");
    }

    function removeBot() {
        if (location === undefined) return;
        busy = true;
        client
            .uninstallBot(location, bot.id)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
                } else {
                    publish("closeModalPage");
                }
            })
            .finally(() => (busy = false));
    }

    function installBot() {
        if (collection === undefined || !installableHere) {
            selectInstallationLocation = true;
        } else {
            publish("installBot", { bot, collection });
        }
    }

    function reviewBot() {
        if (collection && grantedPermissions) {
            publish("installBot", {
                bot,
                collection,
                installedWithPermissions: grantedPermissions,
            });
        }
    }
</script>

{#if selectInstallationLocation}
    <OwnedLocationSelector
        onSelect={(c) => {
            collection = c;
            selectInstallationLocation = false;
            publish("installBot", { bot, collection });
        }} />
{/if}

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
    height={"fill"}
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
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <H2 width={hug} fontWeight={"bold"}>{bot.name}</H2>
                    <div class={`img ${isPublic ? "public" : "private"}`}></div>
                </Container>
                <Container gap={"xs"}>
                    <BodySmall width={"hug"} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Owned by")} />
                    </BodySmall>
                    <BodySmall width={"hug"} colour={"primary"}>
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

    {#if canManageBots}
        <Container gap={"sm"} padding={["zero", "md"]} direction={"vertical"}>
            {#if grantedPermissions !== undefined}
                <Button disabled={busy} onClick={reviewBot}>
                    {#snippet icon(color)}
                        <ChevronRight {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Review bot permissions")} />
                </Button>
                <Button disabled={busy} loading={busy} secondary onClick={removeBot}>
                    {#snippet icon(color)}
                        <DeleteOutline {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Remove bot")} />
                </Button>
            {:else}
                <Button onClick={installBot}>
                    {#snippet icon(color)}
                        <ChevronRight {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Proceed to installation")} />
                </Button>
                <BodySmall align={"center"} colour={"textSecondary"}>
                    {#if installableHere && collectionName !== undefined}
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
                            resourceKey={i18nKey(
                                `Choose a location in which to install this bot.`,
                            )} />
                    {/if}
                </BodySmall>
            {/if}
        </Container>
    {/if}

    <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Description")} />
        </Body>
        <ReadMore>
            <Body colour={"textSecondary"}>
                <Markdown inline={false} text={bot.definition.description} />
            </Body>
        </ReadMore>
    </Container>

    <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Commands")} />
        </Body>
        <BotCommands commands={bot.definition.commands} {grantedPermissions} />
    </Container>

    <BotsPermissionInfo />

    {#if bot.definition.commands.length > 0}
        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Command permissions")} />
            </Body>
            {@render permissionsView(requestedPermissions.command, grantedPermissions?.command)}
        </Container>
    {/if}

    {#if requestedPermissions.autonomous !== undefined}
        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Autonomous permissions")} />
            </Body>
            {@render permissionsView(
                requestedPermissions.autonomous,
                grantedPermissions?.autonomous,
            )}
        </Container>
    {/if}

    <Container
        padding={["zero", "md"]}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}>
        <CommonButton onClick={likeBot} mode={"active"} size={"small_text"}>
            {#snippet icon(color, size)}
                <ThumbUp {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("I like this")} />
        </CommonButton>
        <CommonButton onClick={tipBot} mode={"active"} size={"medium"}>
            {#snippet icon(color, size)}
                <Bitcoin {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Tip the creator")} />
        </CommonButton>
    </Container>
</Container>

{#snippet permList(
    name: string,
    Icon: any,
    requested: (BotChatPermission | BotCommunityPermission | MessagePermission)[],
    granted: (BotChatPermission | BotCommunityPermission | MessagePermission)[] | undefined,
    labelPrefix: string = "",
)}
    <Container wrap crossAxisAlignment={"center"} gap={"xs"}>
        <Icon color={ColourVars.primary} />
        <Body width={hug} fontWeight={"bold"} colour={"primary"}>{name}</Body>
        <Body width={hug} fontWeight={"bold"} colour={"textSecondary"}>//</Body>
        {#if requested.length === 0}
            <Body width={hug}>
                <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
            </Body>
        {:else}
            {#each requested as perm, i}
                {@const isGranted = granted === undefined || granted.includes(perm)}
                {@const last = i === requested.length - 1}
                <Body colour={isGranted ? "textPrimary" : "textTertiary"} width={hug}>
                    <Translatable resourceKey={i18nKey(`permissions.${labelPrefix}${perm}`)} />
                    {#if !last}
                        {","}
                    {/if}
                </Body>
            {/each}
        {/if}
    </Container>
{/snippet}

{#snippet permissionsView(requested: ExternalBotPermissions, granted?: ExternalBotPermissions)}
    <Container direction={"vertical"} gap={"xl"}>
        {@const showCommunity = location === undefined || location.kind === "community"}
        {#if showCommunity}
            {@render permList(
                "In communities",
                AccountGroup,
                requested.communityPermissions,
                granted?.communityPermissions,
            )}
        {/if}
        {@render permList(
            "In chats",
            ForumOutline,
            requested.chatPermissions,
            granted?.chatPermissions,
        )}
        {@render permList(
            "For messages",
            ChatOutline,
            requested.messagePermissions,
            granted?.messagePermissions,
            "messagePermissions.",
        )}
    </Container>
{/snippet}

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

    .img {
        background-repeat: no-repeat;
        $size: 1rem;
        flex: 0 0 $size;
        width: $size;
        height: $size;

        &.public {
            background-image: url("/assets/unlocked.svg");
        }

        &.private {
            background-image: url("/assets/locked.svg");
        }
    }
</style>
