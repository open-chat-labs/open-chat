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
    import { openMiniApp } from "@src/logic/miniApp/openMiniApp.svelte";
    import { miniAppUrl } from "@src/utils/miniApp";
    import { buildDisplayName } from "@src/utils/user";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Avatar from "../Avatar.svelte";
    import Button from "../Button.svelte";

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
            {#each view.actions as action, i (action)}
                <!-- The others open the bot's app -->
                {#if action === "join" || action === "leave" || url !== undefined}
                    <Button
                        tiny
                        secondary={i > 0}
                        loading={actions?.busy === action}
                        disabled={actions?.busy !== undefined}
                        onClick={() => onAction(action)}>
                        <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                    </Button>
                {/if}
            {/each}
        </div>
    {/if}
    {#if actions?.error !== undefined}
        <div class="error">
            <Translatable resourceKey={actions.error} />
        </div>
    {/if}
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
