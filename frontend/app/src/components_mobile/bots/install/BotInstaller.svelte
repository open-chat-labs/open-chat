<script lang="ts">
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        ColourVars,
        Container,
        ReadMore,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import {
        allUsersStore,
        type ChatSummary,
        type CommunitySummary,
        definitionToPermissions,
        type ExternalBotLike,
        type GrantedBotPermissions,
        installationLocationFrom,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Cloud from "svelte-material-icons/CloudDownloadOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Markdown from "../../home/Markdown.svelte";
    import SlidingPageContent from "../../home/SlidingPageContent.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import Translatable from "../../Translatable.svelte";
    import BotAvatar from "../BotAvatar.svelte";
    import BotCommands from "../BotCommands.svelte";
    import BotsPermissionInfo from "../BotsPermissionInfo.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBotLike;
    }

    let { bot, collection }: Props = $props();
    let requestedPermissions = $derived(definitionToPermissions(bot.definition));
    let grantedPermissions = $state(filterByLocation(definitionToPermissions(bot.definition)));
    let location = $derived(installationLocationFrom(collection));
    let level = $derived(collection.kind === "direct_chat" ? "group" : collection.level); // TODO suspect
    let container = $derived.by(() => {
        switch (collection.kind) {
            case "channel":
                return client.getCommunityForChannel(collection.id)!;
            default:
                return collection;
        }
    });
    let containerAvatarUrl = $derived.by(() => {
        switch (container.kind) {
            case "community":
                return client.communityAvatarUrl(container.id.communityId, container.avatar);
            case "group_chat":
                return client.groupAvatarUrl(container);
            case "direct_chat":
                return client.userAvatarUrl($allUsersStore.get(container.id.userId));
        }
    });
    let containerName = $derived.by(() => {
        switch (container.kind) {
            case "direct_chat":
                return (
                    $allUsersStore.get(container.id.userId)?.username ?? "TODO come back to this"
                );
            default:
                return container.name;
        }
    });

    let busy = $state(false);

    function filterByLocation(perm: GrantedBotPermissions): GrantedBotPermissions {
        if (collection.kind === "group_chat") {
            perm.command.communityPermissions = [];
            if (perm.autonomous !== undefined) {
                perm.autonomous.communityPermissions = [];
            }
        }
        return perm;
    }

    function install() {
        busy = true;
        client
            .installBot(location, bot.id, {
                command: grantedPermissions.command,
                autonomous: grantedPermissions.autonomous,
            })
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.add.failure"));
                } else {
                    publish("closeModalPage");
                }
            })
            .finally(() => (busy = false));
    }
</script>

<SlidingPageContent title={i18nKey("bots.add.title", undefined, level, true)}>
    <Container gap={"xl"} direction={"vertical"} padding={["xl", "lg"]}>
        <Container
            padding={"xs"}
            borderRadius={"lg"}
            background={"linear-gradient(90deg, var(--primary), var(--secondary))"}>
            <Container
                padding={"xl"}
                gap={"xxl"}
                direction={"vertical"}
                borderRadius={"md"}
                background={ColourVars.background1}>
                <Container crossAxisAlignment={"start"} gap={"md"}>
                    <BotAvatar size={"xl"} {bot} />
                    <Container
                        overflow={"hidden"}
                        gap={"xxs"}
                        direction={"vertical"}
                        width={{ kind: "fill" }}>
                        <Body colour={"primary"} fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Installing")} />
                        </Body>
                        <Subtitle fontWeight={"bold"}>
                            {bot.name}
                        </Subtitle>
                    </Container>
                </Container>

                <Container
                    borderRadius={"xl"}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    overflow={"visible"}
                    height={{ kind: "fixed", size: "4px" }}
                    background={ColourVars.primary}>
                    <Container
                        supplementalClass={"connecting_arrow"}
                        padding={"sm"}
                        width={{ kind: "hug" }}
                        background={ColourVars.primary}
                        borderRadius={"circle"}>
                        <ArrowDown size={"2rem"} color={ColourVars.background1} />
                    </Container>
                </Container>

                <Container crossAxisAlignment={"start"} gap={"md"}>
                    <Avatar url={containerAvatarUrl} size={"xl"} />
                    <Container
                        overflow={"hidden"}
                        gap={"xxs"}
                        direction={"vertical"}
                        width={{ kind: "fill" }}>
                        <Body colour={"primary"} fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Into")} />
                        </Body>
                        <Subtitle fontWeight={"bold"}>
                            {containerName}
                        </Subtitle>
                    </Container>
                </Container>
            </Container>
        </Container>

        <Container padding={["zero", "md"]} direction={"vertical"}>
            <Body>
                <Translatable resourceKey={i18nKey("About")} />
            </Body>
            <ReadMore>
                <Body colour={"textSecondary"}>
                    <Markdown inline={false} text={bot.definition.description} />
                </Body>
            </ReadMore>
        </Container>

        <BotsPermissionInfo />

        {#if bot.definition.commands.length > 0}
            <Container gap={"lg"} padding={["zero", "md"]} direction={"vertical"}>
                <Body>
                    <Translatable resourceKey={i18nKey("Command permissions")} />
                </Body>
                <ChoosePermissions
                    {level}
                    bind:granted={grantedPermissions.command}
                    requested={requestedPermissions.command} />
            </Container>
        {/if}

        {#if bot.definition.autonomousConfig !== undefined}
            <Container gap={"lg"} padding={["zero", "md"]} direction={"vertical"}>
                <Body>
                    <Translatable resourceKey={i18nKey("Autonomous permissions")} />
                </Body>
                <ChoosePermissions
                    {level}
                    bind:granted={grantedPermissions.autonomous!}
                    requested={requestedPermissions.autonomous!} />
            </Container>
        {/if}

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("Commands")} />
            </BodySmall>
            <BotCommands {grantedPermissions} commands={bot.definition.commands} />
        </Container>

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <StatusCard
                mode={"warning"}
                title={"Granting limited permissions"}
                body={"Granting limited permissions will limit bot's supported commands. Unavailable commands are greyed out."} />
        </Container>

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"lg"}>
            <BodySmall align={"center"} colour={"textSecondary"}>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(
                                "By pressing the button below, you will install this bot int the ",
                            ),
                            colour: "textSecondary",
                        },
                        {
                            text: i18nKey(containerName),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" location."),
                            colour: "textSecondary",
                        },
                    ]}>
                </MulticolourText>
            </BodySmall>
            <Button disabled={busy} loading={busy} onClick={install}>
                {#snippet icon(color)}
                    <Cloud {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("bots.add.install")} />
            </Button>
            <Button
                secondary
                disabled={busy}
                loading={busy}
                onClick={() => publish("closeModalPage")}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.container.connecting_arrow) {
        position: absolute !important;
    }
</style>
