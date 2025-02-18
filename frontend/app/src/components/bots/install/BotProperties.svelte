<script lang="ts">
    import type { BotMatch, ExternalBot, ExternalBotPermissions } from "openchat-client";
    import BotAvatar from "../BotAvatar.svelte";
    import BotCommands from "../BotCommands.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        bot: BotMatch | ExternalBot;
        grantedCommandPermissions?: ExternalBotPermissions;
        installing: boolean;
        padded?: boolean;
        onClick?: (match: BotMatch | ExternalBot) => void;
        children?: Snippet;
    }

    let {
        bot,
        grantedCommandPermissions,
        installing,
        padded = false,
        onClick,
        children,
    }: Props = $props();
    let collapsed = $state(true);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="props"
    class:clickable={onClick !== undefined}
    class:padded
    onclick={() => onClick?.(bot)}>
    <span class="avatar">
        <BotAvatar {bot} />
    </span>
    <div class="details">
        <h4 class="bot-name">
            {bot.name}
            {#if installing}
                <div class="installing"></div>
            {/if}
        </h4>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <p
            title={bot.definition.description}
            class="bot-desc"
            class:collapsed
            onclick={() => (collapsed = !collapsed)}>
            {bot.definition.description}
        </p>
        <BotCommands
            grantedPermissions={grantedCommandPermissions}
            commands={bot.definition.commands} />

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
            gap: $sp4;
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
</style>
