<script lang="ts">
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        ColourVars,
        Container,
        defaultBackgroundGradient,
        FloatingButton,
        ReadMore,
        StatusCard,
        Subtitle,
    } from "component-lib";
    import {
        allUsersStore,
        botContainerFrom,
        type ChatSummary,
        type CommunitySummary,
        type ExternalBotLike,
        type GrantedBotPermissions,
        installationLocationFrom,
        OpenChat,
        publish,
    } from "@client";
    import { getContext, tick, untrack } from "svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Cloud from "svelte-material-icons/CloudDownloadOutline.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Markdown from "@shared_components/Markdown.svelte";
    import SlidingPageContent from "../../home/SlidingPageContent.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { BotInstall } from "@shared_components/bots/install/botInstall.svelte";
    import BotAvatar from "../BotAvatar.svelte";
    import BotCommands from "../BotCommands.svelte";
    import BotsPermissionInfo from "../BotsPermissionInfo.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";

    /**
     * This component is used for both installing a new bot and reviewing the permissions of a bot that is already installed
     */

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBotLike;
        installedWithPermissions?: GrantedBotPermissions;
    }

    let { bot, collection, installedWithPermissions }: Props = $props();
    let location = $derived(installationLocationFrom(collection));
    const form = new BotInstall(
        client,
        untrack(() => bot),
        untrack(() => location),
        untrack(() => installedWithPermissions),
    );
    let level = $derived(collection.kind === "direct_chat" ? "group" : collection.level); // TODO suspect
    let container = $derived(botContainerFrom(collection));
    let containerAvatarUrl = $derived.by(() => {
        if (container === undefined) return undefined;
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
        if (container === undefined) return undefined;
        switch (container.kind) {
            case "direct_chat":
                return $allUsersStore.get(container.id.userId)?.username ?? "Unknown user";
            default:
                return container.name;
        }
    });

    async function save() {
        const outcome = await form.save();
        switch (outcome.kind) {
            case "installed":
            case "updated":
                publish("closeModalPage");
                break;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                break;
            default:
                outcome satisfies never;
        }
    }

    function cancel() {
        if (collection.kind === "direct_chat") {
            client.removeChat(collection.id);
            publish("clearSelection");
        }
        tick().then(() => publish("closeModalPage"));
    }
</script>

<SlidingPageContent
    onBack={cancel}
    title={i18nKey(
        form.installing ? "bots.add.title" : "Review bot permissions",
        undefined,
        level,
        true,
    )}>
    <Container height={"fill"} gap={"xl"} direction={"vertical"} padding={["xl", "lg"]}>
        <Container gap={"sm"} direction={"vertical"}>
            <Container
                overflow={"visible"}
                borderRadius={"md"}
                padding={"md"}
                background={defaultBackgroundGradient}
                crossAxisAlignment={"start"}
                gap={"md"}>
                <BotAvatar size={"xl"} {bot} />
                <Container
                    overflow={"hidden"}
                    gap={"xxs"}
                    direction={"vertical"}
                    width={"fill"}>
                    <Body colour={"textPrimary"} fontWeight={"bold"}>
                        <Translatable
                            resourceKey={i18nKey(form.installing ? "Installing" : "Reviewing")} />
                    </Body>
                    <Subtitle colour={"textOnPrimary"} fontWeight={"bold"}>
                        {bot.name}
                    </Subtitle>
                </Container>
            </Container>

            <Container
                overflow={"visible"}
                borderRadius={"md"}
                padding={"md"}
                background={defaultBackgroundGradient}
                crossAxisAlignment={"start"}
                gap={"md"}>
                <Avatar url={containerAvatarUrl!} size={"xl"} />
                <Container
                    overflow={"hidden"}
                    gap={"xxs"}
                    direction={"vertical"}
                    width={"fill"}>
                    <Body colour={"textPrimary"} fontWeight={"bold"}>
                        {#if collection.kind === "direct_chat"}
                            <Translatable resourceKey={i18nKey("As a direct chat with")} />
                        {:else}
                            <Translatable
                                resourceKey={i18nKey(form.installing ? "Into" : "Installed in")} />
                        {/if}
                    </Body>
                    <Subtitle colour={"textOnPrimary"} fontWeight={"bold"}>
                        {containerName}
                    </Subtitle>
                </Container>
                <Container
                    supplementalClass={"connecting_arrow"}
                    padding={"sm"}
                    width={"hug"}
                    background={ColourVars.surface1}
                    borderRadius={"circle"}>
                    <ArrowDown size={"1.2rem"} color={ColourVars.primary} />
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
                    bind:granted={form.grantedPermissions.command}
                    requested={form.requestedPermissions.command} />
            </Container>
        {/if}

        {#if bot.definition.autonomousConfig !== undefined}
            <Container gap={"lg"} padding={["zero", "md"]} direction={"vertical"}>
                <Body>
                    <Translatable resourceKey={i18nKey("Autonomous permissions")} />
                </Body>
                <ChoosePermissions
                    {level}
                    bind:granted={form.grantedPermissions.autonomous!}
                    requested={form.requestedPermissions.autonomous!} />
            </Container>
        {/if}

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("Commands")} />
            </BodySmall>
            <BotCommands grantedPermissions={form.grantedPermissions} commands={bot.definition.commands} />
        </Container>

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <StatusCard
                mode={"warning"}
                title={"Granting limited permissions"}
                body={"Granting limited permissions will limit bot's supported commands. Unavailable commands are greyed out."} />
        </Container>

        {#if form.installing}
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
                                text: i18nKey(containerName!),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(" location."),
                                colour: "textSecondary",
                            },
                        ]}>
                    </MulticolourText>
                </BodySmall>
                <Button disabled={form.busy} loading={form.busy} onClick={save}>
                    {#snippet icon(color)}
                        <Cloud {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("bots.add.install")} />
                </Button>
                <Button secondary disabled={form.busy} onClick={cancel}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
            </Container>
        {/if}
    </Container>
    {#if !form.installing}
        <FloatingButton loading={form.busy} pos={{ bottom: "lg", right: "lg" }} onClick={save}>
            {#snippet icon(color)}
                <Save {color} />
            {/snippet}
        </FloatingButton>
    {/if}
</SlidingPageContent>

<style lang="scss">
    :global(.container.connecting_arrow) {
        position: absolute !important;
        top: 0;
        left: 50%;
        transform: translateY(calc(-50% - 4px)) translateX(-50%);
    }
</style>
