<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        botState,
        currentUserIdStore,
        miniAppAction,
        type MessageContext,
        type MiniAppContent,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/core/Markdown.svelte";
    import { openMiniApp } from "@src/logic/miniApp/openMiniApp.svelte";
    import { miniAppUrl } from "@src/utils/miniApp";
    import { buildDisplayName } from "@src/utils/user";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext } from "svelte";
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
        // eg. while previewing a chat, whose app the user can't open
        readonly: boolean;
        reply?: boolean;
        pinned?: boolean;
        blockLevelMarkdown: boolean;
    }

    let {
        content,
        messageContext,
        messageId,
        senderId,
        readonly,
        reply = false,
        pinned = false,
        blockLevelMarkdown,
    }: Props = $props();

    let bot = $derived(botState.externalBots.get(senderId));
    let url = $derived(
        bot === undefined ? undefined : miniAppUrl(bot.endpoint, window.location.origin),
    );
    let action = $derived(miniAppAction(content, $currentUserIdStore));
    let myMove = $derived(content.waitingFor?.includes($currentUserIdStore) ?? false);

    function name(userId: string): string {
        if (userId === senderId && bot !== undefined) return bot.name;
        return buildDisplayName(
            $allUsersStore,
            userId,
            userId === $currentUserIdStore ? "me" : "user",
            false,
        );
    }

    function open() {
        if (url === undefined || bot === undefined) return;
        openMiniApp.open({
            url,
            botName: bot.name,
            chatId: messageContext.chatId,
            threadRootMessageIndex: messageContext.threadRootMessageIndex,
            messageId,
            botId: senderId,
        });
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
    {#if content.players.length > 0 || content.maxPlayers !== undefined}
        <div class="players">
            <div class="count">
                {#if content.maxPlayers !== undefined}
                    <Translatable
                        resourceKey={i18nKey("bots.miniApp.playingOf", {
                            count: content.players.length,
                            max: content.maxPlayers,
                        })} />
                {:else}
                    <Translatable
                        resourceKey={i18nKey("bots.miniApp.playing", {
                            count: content.players.length,
                        })} />
                {/if}
            </div>
            {#each content.players as player (player)}
                <div class="player" class:to-move={content.waitingFor?.includes(player)}>
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
        {#if content.status === "finished"}
            <span class="result">
                {#if content.result !== undefined}
                    {content.result}
                {:else}
                    <Translatable resourceKey={i18nKey("bots.miniApp.finished")} />
                {/if}
            </span>
        {:else if myMove}
            <span class="your-move"><Translatable resourceKey={i18nKey("bots.miniApp.yourMove")} /></span>
        {/if}
        {#if content.spectators && content.spectatorCount > 0}
            <span class="watching">
                <Translatable
                    resourceKey={i18nKey("bots.miniApp.watching", {
                        count: content.spectatorCount,
                    })} />
            </span>
        {/if}
    </div>
    {#if !readonly && url !== undefined && action !== undefined}
        <div class="open">
            <Button tiny onClick={open}>
                <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
            </Button>
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

    .your-move,
    .result {
        font-weight: 700;
    }

    .watching {
        color: var(--txt-light);
    }

    .open {
        margin-top: $sp3;
    }
</style>
