<script lang="ts">
    import type { ExternalBotLike, ExternalBotPermissions, OpenChat } from "openchat-client";
    import { AvatarSize, userStore } from "openchat-client";
    import BotAvatar from "../BotAvatar.svelte";
    import BotCommands from "../BotCommands.svelte";
    import { getContext, type Snippet } from "svelte";
    import { mobileWidth } from "@src/stores/screenDimensions";
    import Avatar from "@src/components/Avatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        bot: ExternalBotLike;
        grantedCommandPermissions?: ExternalBotPermissions;
        installing: boolean;
        padded?: boolean;
        onClick?: (match: ExternalBotLike) => void;
        children?: Snippet;
        showAvatar?: boolean;
        showCommands?: boolean;
    }

    let {
        bot,
        grantedCommandPermissions,
        installing,
        padded = false,
        onClick,
        children,
        showAvatar = !$mobileWidth,
        showCommands = true,
    }: Props = $props();
    let collapsed = $state(true);
    let owner = $derived($userStore.get(bot.ownerId));
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
            <h4>{bot.name}</h4>
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <p
            title={bot.definition.description}
            class="bot-desc"
            class:collapsed
            onclick={() => (collapsed = !collapsed)}>
            {bot.definition.description}
        </p>
        {#if showCommands}
            <BotCommands
                grantedPermissions={grantedCommandPermissions}
                commands={bot.definition.commands} />
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
            @media (hover: hover) {
                &:hover {
                    background-color: var(--members-hv);
                }
            }

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
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            margin-bottom: $sp3;

            &.collapsed {
                @include clamp(4);
            }
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
</style>
