<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        botState,
        type ChatSummary,
        type CommandDefinition,
        directChatBotsStore,
        emptyGrantedBotPermissions,
        type GrantedBotPermissions,
        isProposalGroupStore,
        type OpenChat,
        type ResourceKey,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Avatar from "../Avatar.svelte";
    import BotCommands from "../bots/BotCommands.svelte";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import Robot from "../Robot.svelte";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    type BotState = {
        commands: CommandDefinition[];
        grantedPermissions: GrantedBotPermissions;
    };

    type State = {
        title: ResourceKey;
        verified: boolean;
        description?: string;
        avatarUrl: string;
        subtitle?: ResourceKey;
        bot?: BotState;
    };

    interface Props {
        chat: ChatSummary;
    }

    let { chat }: Props = $props();

    let state = $derived.by<State>(() => {
        switch (chat.kind) {
            case "direct_chat":
                const them = $allUsersStore.get(chat.them.userId);
                const s: State = {
                    title: i18nKey(client.displayName(them)),
                    verified: false,
                    avatarUrl: client.userAvatarUrl($allUsersStore.get(chat.them.userId)),
                };
                const bot = botState.externalBots.get(chat.them.userId);
                const perm =
                    $directChatBotsStore.get(chat.them.userId) ?? emptyGrantedBotPermissions();
                return bot === undefined
                    ? s
                    : {
                          ...s,
                          description: bot.definition.description,
                          bot: {
                              commands: bot.definition.commands,
                              grantedPermissions: perm,
                          },
                      };
            default:
                return {
                    title: i18nKey("group.welcome", { groupName: chat.name }),
                    verified: chat.kind === "group_chat" ? chat.verified : false,
                    description: chat.description,
                    avatarUrl: client.groupAvatarUrl(chat, $selectedCommunitySummaryStore),
                    subtitle: i18nKey(
                        chat.public ? "thisIsPublicGroupWithN" : "thisIsPrivateGroupWithN",
                        { number: chat.memberCount },
                        chat.level,
                        true,
                    ),
                    bot: undefined,
                };
        }
    });
</script>

<div class="container">
    {#if $isProposalGroupStore}
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
            <Avatar url={state.avatarUrl} size={AvatarSize.Large} />
        </div>
        {#if state.description && state.description.length > 0}
            <Markdown inline={false} text={state.description} />
        {/if}
        {#if state.bot !== undefined}
            <BotCommands centered {...state.bot} />
        {/if}
        {#if state.subtitle}
            <Translatable resourceKey={state.subtitle} />
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
