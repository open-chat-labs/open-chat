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
    import { MiniAppFullScreen, MiniAppPresence } from "@src/logic/miniApp/miniAppFrame.svelte";
    import type { HostedMiniApp } from "@src/logic/miniApp/miniAppHost.svelte";
    import { miniAppUrl } from "@src/utils/miniApp";
    import { buildDisplayName } from "@src/utils/user";
    import Translatable from "@shared_components/Translatable.svelte";
    import { Avatar, BodySmall, Button, Caption, Column, Row } from "component-lib";
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import MiniAppFrame from "./MiniAppFrame.svelte";

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
        // a preview of the message elsewhere, eg. where it's linked from another message
        preview?: boolean;
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
        preview = false,
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
    // the app, where the game's shown and played, from the card itself
    let hosted = $derived<HostedMiniApp | undefined>(
        !reply &&
            !pinned &&
            !preview &&
            url !== undefined &&
            bot !== undefined &&
            game !== undefined
            ? { url, botName: bot.name, game, content }
            : undefined,
    );

    // The service shows the card live once it's in view
    $effect(() => {
        if (intersecting && !reply && game !== undefined) {
            client.followMiniApp(game);
        }
    });

    // The app's shown while the card's on screen, which opens the game: a player sees it as it
    // stands, and anyone else is watching it, if the game allows that
    const presence = new MiniAppPresence();
    const fullScreen = new MiniAppFullScreen();
    let card: HTMLElement | undefined = $state();
    let showApp = $state(false);
    $effect(() => {
        // Only the card itself is read here: watching it again would drop the app for a moment
        const el = card;
        if (!el) return;
        return untrack(() => presence.observe(el));
    });
    $effect(() => presence.hold(fullScreen.on));
    $effect(() => {
        if (!presence.shown || hosted === undefined) {
            showApp = false;
        } else if (view.canOpen) {
            showApp = true;
        } else if (view.status !== "finished") {
            // eg. the user left a game which can't be watched, so there's nothing to show until
            // they join again
            showApp = false;
        }
        // A finished game's app stays as it is: one showing the game as it finished keeps its end
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
        if (action === "join") {
            void actions?.join();
        } else {
            void actions?.leave();
        }
    }
</script>

<div bind:this={card}>
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
            {#if showApp && hosted !== undefined && actions !== undefined}
                <MiniAppFrame app={hosted} {actions} {fullScreen} />
            {/if}
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
                                    fontWeight={view.waitingFor.includes(player)
                                        ? "bold"
                                        : undefined}>
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
                    {#each view.actions as action (action)}
                        <Button
                            width={"hug"}
                            secondary={action === "leave"}
                            loading={actions?.busy === action}
                            disabled={actions?.busy !== undefined}
                            onClick={() => onAction(action)}>
                            <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                        </Button>
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
</div>

<style lang="scss">
    .image {
        display: block;
        width: 100%;
        max-height: 15rem;
        object-fit: cover;
        border-radius: var(--rad-md);
    }
</style>
