<script lang="ts">
    import {
        allUsersStore,
        botState,
        currentUserIdStore,
        miniAppCardsStore,
        miniAppCardView,
        miniAppGame,
        miniAppGameKey,
        type MessageContext,
        type MiniAppAction,
        type MiniAppContent,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/core/Markdown.svelte";
    import { MiniAppActions } from "@src/logic/miniApp/miniAppActions.svelte";
    import { openMiniApp } from "@src/logic/miniApp/openMiniApp.svelte";
    import { miniAppUrl } from "@src/utils/miniApp";
    import { buildDisplayName } from "@src/utils/user";
    import Translatable from "@shared_components/Translatable.svelte";
    import { Avatar, BodySmall, Button, Caption, Column, Row } from "component-lib";
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: MiniAppContent;
        messageContext: MessageContext;
        messageId: bigint;
        // the bot which posted it
        senderId: string;
        intersecting: boolean;
        reply?: boolean;
        pinned?: boolean;
        blockLevelMarkdown: boolean;
    }

    let {
        content,
        messageContext,
        messageId,
        senderId,
        intersecting,
        reply = false,
        pinned = false,
        blockLevelMarkdown,
    }: Props = $props();

    // fixed for the card's life
    const game = untrack(() => miniAppGame(messageContext, messageId));
    const actions = game === undefined ? undefined : new MiniAppActions(client, game);

    let bot = $derived(botState.externalBots.get(senderId));
    let url = $derived(
        bot === undefined ? undefined : miniAppUrl(bot.endpoint, window.location.origin),
    );
    let live = $derived(
        game === undefined ? undefined : $miniAppCardsStore.get(miniAppGameKey(game)),
    );
    let view = $derived(miniAppCardView(content, live, $currentUserIdStore));
    let playersKey = $derived(view.players.join());

    // The service shows the card live once it's in view
    $effect(() => {
        if (intersecting && !reply && game !== undefined) {
            client.followMiniApp(game);
        }
    });

    $effect(() => {
        if (playersKey !== "") {
            untrack(() => client.getMissingUsers(view.players));
        }
    });

    function name(userId: string): string {
        return buildDisplayName(
            $allUsersStore,
            userId,
            userId === $currentUserIdStore ? "me" : "user",
            false,
        );
    }

    function onAction(action: MiniAppAction) {
        switch (action) {
            case "join":
                void actions?.join();
                return;
            case "leave":
                void actions?.leave();
                return;
            default:
                if (url !== undefined && bot !== undefined && game !== undefined) {
                    openMiniApp.open({ url, botName: bot.name, game, content });
                }
        }
    }
</script>

<Column gap={"md"}>
    {#if reply}
        <Markdown text={content.text} oneLine suppressLinks />
    {:else}
        {#if content.image?.blobUrl !== undefined}
            <img
                class="image"
                src={content.image.blobUrl}
                alt=""
                style={`aspect-ratio: ${content.image.width} / ${content.image.height}`} />
        {/if}
        <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} text={content.text} />
        {#if view.players.length > 0 || (live !== undefined && view.status === "open")}
            <Column gap={"xs"}>
                {#if view.status !== "finished"}
                    <Caption colour={"textSecondary"}>
                        {#if content.maxPlayers !== undefined}
                            <Translatable
                                resourceKey={i18nKey("bots.miniApp.playingOf", {
                                    count: view.players.length,
                                    max: content.maxPlayers,
                                })} />
                        {:else}
                            <Translatable
                                resourceKey={i18nKey("bots.miniApp.playing", {
                                    count: view.players.length,
                                })} />
                        {/if}
                    </Caption>
                {/if}
                <Row gap={"sm"} wrap>
                    {#each view.players as player (player)}
                        <Row gap={"xs"} crossAxisAlignment={"center"} width={"hug"}>
                            <Avatar
                                size={"xs"}
                                url={client.userAvatarUrl($allUsersStore.get(player))} />
                            <BodySmall
                                width={"hug"}
                                fontWeight={view.waitingFor.includes(player) ? "bold" : undefined}>
                                {name(player)}
                            </BodySmall>
                        </Row>
                    {/each}
                </Row>
            </Column>
        {/if}
        {#if view.status === "finished"}
            <BodySmall fontWeight={"bold"}>
                {#if view.result !== undefined}
                    {view.result}
                {:else}
                    <Translatable resourceKey={i18nKey("bots.miniApp.finished")} />
                {/if}
            </BodySmall>
        {:else if view.yourTurn}
            <BodySmall fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("bots.miniApp.yourTurn")} />
            </BodySmall>
        {:else if view.waitingFor.length > 0}
            <BodySmall>
                <Translatable
                    resourceKey={i18nKey("bots.miniApp.waitingFor", {
                        names: view.waitingFor.map(name).join(", "),
                    })} />
            </BodySmall>
        {/if}
        {#if view.watching !== undefined && view.watching > 0}
            <Caption colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("bots.miniApp.watching", { count: view.watching })} />
            </Caption>
        {/if}
        {#if view.actions.length > 0}
            <Row gap={"sm"} wrap>
                {#each view.actions as action, i (action)}
                    <!-- The others open the bot's app -->
                    {#if action === "join" || action === "leave" || url !== undefined}
                        <Button
                            width={"hug"}
                            secondary={i > 0}
                            loading={actions?.busy === action}
                            disabled={actions?.busy !== undefined}
                            onClick={() => onAction(action)}>
                            <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                        </Button>
                    {/if}
                {/each}
            </Row>
        {/if}
        {#if actions?.error !== undefined}
            <BodySmall colour={"validationError"}>
                <Translatable resourceKey={actions.error} />
            </BodySmall>
        {/if}
    {/if}
</Column>

<style lang="scss">
    .image {
        display: block;
        width: 100%;
        max-height: 15rem;
        object-fit: cover;
        border-radius: var(--rad-md);
    }
</style>
