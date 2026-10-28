<script lang="ts">
    import {
        allUsersStore,
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
    import { Avatar, BodySmall, Button, Caption, Column, Row } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";

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
        {#if content.players.length > 0 || content.maxPlayers !== undefined}
            <Column gap={"xs"}>
                <Caption colour={"textSecondary"}>
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
                </Caption>
                <Row gap={"sm"} wrap>
                    {#each content.players as player (player)}
                        <Row gap={"xs"} crossAxisAlignment={"center"} width={"hug"}>
                            <Avatar
                                size={"xs"}
                                url={client.userAvatarUrl($allUsersStore.get(player))} />
                            <BodySmall
                                width={"hug"}
                                fontWeight={content.waitingFor?.includes(player)
                                    ? "bold"
                                    : undefined}>
                                {name(player)}
                            </BodySmall>
                        </Row>
                    {/each}
                </Row>
            </Column>
        {/if}
        {#if content.status === "finished"}
            <BodySmall fontWeight={"bold"}>
                {#if content.result !== undefined}
                    {content.result}
                {:else}
                    <Translatable resourceKey={i18nKey("bots.miniApp.finished")} />
                {/if}
            </BodySmall>
        {:else if myMove}
            <BodySmall fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("bots.miniApp.yourMove")} />
            </BodySmall>
        {/if}
        {#if content.spectators && content.spectatorCount > 0}
            <Caption colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("bots.miniApp.watching", {
                        count: content.spectatorCount,
                    })} />
            </Caption>
        {/if}
        {#if !readonly && url !== undefined && action !== undefined}
            <Button width={"hug"} onClick={open}>
                <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
            </Button>
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
