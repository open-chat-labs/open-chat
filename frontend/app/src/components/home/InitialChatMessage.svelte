<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import {
        AvatarSize,
        externalBots,
        isProposalGroup,
        selectedCommunity,
        type ResourceKey,
    } from "openchat-client";
    import { type ChatSummary, type OpenChat, userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import Markdown from "./Markdown.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import Robot from "../Robot.svelte";

    const client = getContext<OpenChat>("client");

    type State = {
        title: ResourceKey;
        verified: boolean;
        description?: string;
        avatarUrl: string;
        subtitle?: ResourceKey;
        bot: boolean;
    };

    interface Props {
        chat: ChatSummary;
    }

    let { chat }: Props = $props();

    let state = $derived.by<State>(() => {
        switch (chat.kind) {
            case "direct_chat":
                const s: State = {
                    title: i18nKey($userStore.get(chat.them.userId)?.username ?? "unknownUser"),
                    verified: false,
                    avatarUrl: client.userAvatarUrl($userStore.get(chat.them.userId)),
                    bot: false,
                };
                const bot = $externalBots.get(chat.them.userId);
                return bot === undefined
                    ? s
                    : {
                          ...s,
                          description: bot.definition.description,
                          bot: true,
                      };
            default:
                return {
                    title: i18nKey("group.welcome", { groupName: chat.name }),
                    verified: chat.kind === "group_chat" ? chat.verified : false,
                    description: chat.description,
                    avatarUrl: client.groupAvatarUrl(chat, $selectedCommunity),
                    subtitle: i18nKey(
                        chat.public ? "thisIsPublicGroupWithN" : "thisIsPrivateGroupWithN",
                        { number: chat.memberCount },
                        chat.level,
                        true,
                    ),
                    bot: false,
                };
        }
    });
</script>

<div class="container">
    {#if $isProposalGroup}
        <ProposalBot />
    {:else if chat.kind === "direct_chat" && client.isOpenChatBot(chat.them.userId)}
        <Robot />
    {:else}
        <WithVerifiedBadge verified={state.verified} size={"small"}>
            <h4 class="welcome">
                <Translatable resourceKey={state.title} />
            </h4>
        </WithVerifiedBadge>
        <div class="pop">
            <Avatar bot={state.bot} url={state.avatarUrl} size={AvatarSize.Large} />
        </div>
        {#if state.description && state.description.length > 0}
            <div>
                <Markdown inline={false} text={state.description} />
            </div>
        {/if}
        {#if state.subtitle}
            <div>
                <Translatable resourceKey={state.subtitle} />
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
        margin: $sp4 auto;
        text-align: center;
        background-color: var(--timeline-bg);
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);
        max-width: toRem(400);
    }

    .welcome {
        @include font(bold, normal, fs-120);
        color: var(--txt);
    }

    .pop {
        @include pop(400ms);
    }
</style>
