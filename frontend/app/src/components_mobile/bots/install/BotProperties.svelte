<script lang="ts">
    import Avatar from "@src/components/Avatar.svelte";
    import Markdown from "@src/components/home/Markdown.svelte";
    import type { ExternalBotLike, GrantedBotPermissions, OpenChat } from "openchat-client";
    import { AvatarSize, allUsersStore, currentUserIdStore, mobileWidth } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import BotAvatar from "../BotAvatar.svelte";
    import BotCommands from "../BotCommands.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        bot: ExternalBotLike;
        grantedPermissions?: GrantedBotPermissions;
        installing: boolean;
        padded?: boolean;
        onClick?: (match: ExternalBotLike) => void;
        children?: Snippet;
        showAvatar?: boolean;
        showCommands?: boolean;
    }

    let {
        bot,
        grantedPermissions,
        installing,
        padded = false,
        onClick,
        children,
        showAvatar = !$mobileWidth,
        showCommands = true,
    }: Props = $props();
    let owner = $derived($allUsersStore.get(bot.ownerId));
    let isPublic = $derived(
        bot.kind === "external_bot" && bot.registrationStatus.kind === "public",
    );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="props"
    class:clickable={onClick !== undefined}
    class:padded
    onclick={() => onClick?.(bot)}>
    {#if showAvatar}
        <span class="avatar">
            <BotAvatar {bot} />
        </span>
    {/if}
    <div class="details">
        <div class="bot-name">
            <h4>
                <div class={`img ${isPublic ? "public" : "private"}`}></div>
                {bot.name}
            </h4>
            {#if owner}
                <div class="owner">
                    <Avatar url={client.userAvatarUrl(owner)} size={AvatarSize.Tiny} />
                    <span class="username">{owner.username}</span>
                </div>
            {/if}
            {#if installing}
                <div class="installing"></div>
            {/if}
        </div>
        <div class="bot-desc">
            <Markdown inline={false} text={bot.definition.description} />
        </div>
        {#if bot.ownerId === $currentUserIdStore}
            <div class="bot-id">
                bot id: {bot.id}
            </div>
        {/if}
        {#if showCommands}
            <BotCommands {grantedPermissions} commands={bot.definition.commands} />
        {/if}

        {@render children?.()}
    </div>
</div>

<style lang="scss">
    .props {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;

        &.clickable {
            cursor: pointer;
        }

        &.padded {
            padding: $sp4;
            transition:
                background-color ease-in-out 100ms,
                border-color ease-in-out 100ms;
            /* @media (hover: hover) {
                &:hover {
                    background-color: var(--members-hv);
                }
            } */

            @include mobile() {
                padding: $sp3 toRem(10);
            }
        }
    }

    .avatar {
        flex: 0 0 50px;
        position: relative;
        align-self: start;
    }

    .installing {
        margin-left: $sp3;
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "/assets/plain-spinner.svg");
    }

    .details {
        display: flex;
        gap: $sp2;
        flex: 1;
        flex-direction: column;
        @include font(book, normal, fs-100);

        .bot-name {
            @include ellipsis();
            display: flex;
            gap: $sp3;
            @include font(book, normal, fs-110);

            h4 {
                display: flex;
                gap: $sp2;
                align-items: center;
            }
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            margin-bottom: $sp3;
            max-height: 300px;
            overflow: auto;
        }
    }

    .owner {
        padding: $sp1 $sp3;
        border: var(--bw) solid var(--bd);
        border-radius: $sp2;
        display: flex;
        gap: $sp2;
        align-items: center;
        color: var(--txt-light);
        @include font(light, normal, fs-90);

        .username {
            flex: auto;
        }
    }

    .img {
        background-repeat: no-repeat;
        $size: 12px;
        flex: 0 0 $size;
        width: $size;
        height: $size;

        &.public {
            background-image: url("/assets/unlocked.svg");
        }

        &.private {
            background-image: url("/assets/locked.svg");
        }
    }

    .bot-id {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
        font: courier;
        margin-bottom: $sp3;
    }
</style>
