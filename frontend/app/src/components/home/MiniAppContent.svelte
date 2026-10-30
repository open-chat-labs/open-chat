<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
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
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Avatar from "../Avatar.svelte";
    import Button from "../Button.svelte";
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

    // The frame's in the card while the user may open the game, so the card has its size before the
    // app loads, and keeps it while the app's away. The app runs in it while the card's on screen,
    // which opens the game: a player sees it as it stands, and anyone else is watching it, if the
    // game allows that.
    const presence = new MiniAppPresence();
    const fullScreen = new MiniAppFullScreen();
    let card: HTMLElement | undefined = $state();
    let frame = $state(false);
    let active = $derived(frame && presence.shown);
    $effect(() => {
        // Only the card itself is read here: watching it again would drop the app for a moment
        const el = card;
        if (!el) return;
        return untrack(() => presence.observe(el));
    });
    $effect(() => presence.hold(fullScreen.on));
    $effect(() => {
        if (hosted === undefined) {
            frame = false;
        } else if (view.canOpen) {
            frame = true;
        } else if (view.status !== "finished" || !presence.shown) {
            // eg. the user left a game which can't be watched, so there's nothing to show until
            // they join again; and a finished game's app stays only while the card's on screen
            frame = false;
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

{#if reply}
    <Markdown text={content.text} oneLine suppressLinks />
{:else}
    <div bind:this={card}>
        {#if content.image?.blobUrl !== undefined}
            <img
                class="image"
                src={content.image.blobUrl}
                alt=""
                style={`aspect-ratio: ${content.image.width} / ${content.image.height}`} />
        {/if}
        <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} text={content.text} />
        {#if frame && hosted !== undefined && actions !== undefined}
            <MiniAppFrame app={hosted} {actions} {fullScreen} {active} />
        {/if}
        {#if view.players.length > 0 || (live !== undefined && view.status === "open")}
            <div class="players">
                {#if view.status !== "finished"}
                    <div class="count">
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
                    </div>
                {/if}
                {#each view.players as player (player)}
                    <div class="player" class:to-move={view.waitingFor.includes(player)}>
                        <Avatar
                            url={client.userAvatarUrl($allUsersStore.get(player))}
                            userId={player}
                            size={AvatarSize.Tiny} />
                        <span>{name(player)}</span>
                    </div>
                {/each}
            </div>
        {/if}
        <div class="state">
            {#if view.status === "finished"}
                <span class="result">
                    {#if view.result !== undefined}
                        {view.result}
                    {:else}
                        <Translatable resourceKey={i18nKey("bots.miniApp.finished")} />
                    {/if}
                </span>
            {:else if view.yourTurn}
                <span class="your-turn">
                    <Translatable resourceKey={i18nKey("bots.miniApp.yourTurn")} />
                </span>
            {:else if view.waitingFor.length > 0}
                <span>
                    <Translatable
                        resourceKey={i18nKey("bots.miniApp.waitingFor", {
                            names: view.waitingFor.map(name).join(", "),
                        })} />
                </span>
            {/if}
            {#if view.watching !== undefined && view.watching > 0}
                <span class="watching">
                    <Translatable
                        resourceKey={i18nKey("bots.miniApp.watching", { count: view.watching })} />
                </span>
            {/if}
        </div>
        {#if view.actions.length > 0}
            <div class="actions">
                {#each view.actions as action (action)}
                    <Button
                        tiny
                        secondary={action === "leave"}
                        loading={actions?.busy === action}
                        disabled={actions?.busy !== undefined}
                        onClick={() => onAction(action)}>
                        <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                    </Button>
                {/each}
            </div>
        {/if}
        {#if actions?.error !== undefined}
            <div class="error">
                <Translatable resourceKey={actions.error} />
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    .image {
        display: block;
        width: 100%;
        max-height: toRem(240);
        object-fit: cover;
        border-radius: var(--rd);
        margin-bottom: $sp3;
    }

    .players {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: $sp2 $sp3;
        margin-top: $sp3;
    }

    .count {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        width: 100%;
    }

    .player {
        display: flex;
        align-items: center;
        gap: $sp2;
        @include font(book, normal, fs-80);

        &.to-move {
            font-weight: 700;
        }
    }

    .state {
        display: flex;
        flex-wrap: wrap;
        gap: $sp3;
        margin-top: $sp2;
        @include font(book, normal, fs-80);

        &:empty {
            display: none;
        }
    }

    .your-turn,
    .result {
        font-weight: 700;
    }

    .watching {
        color: var(--txt-light);
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: $sp2;
        margin-top: $sp3;
    }

    .error {
        margin-top: $sp2;
        @include font(book, normal, fs-80);
        color: var(--error);
    }
</style>
