<script lang="ts">
    import {
        AvatarSize,
        type BotMatch,
        type CommunityIdentifier,
        type GroupChatIdentifier,
    } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import BotSummary from "./BotSummary.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";

    interface Props {
        match: BotMatch;
        id: CommunityIdentifier | GroupChatIdentifier;
    }

    let { match, id }: Props = $props();
    let showing = $state(false);
</script>

{#if showing}
    <BotSummary mode={"adding"} {id} onClose={() => (showing = false)} bot={match} />
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="bot-match" onclick={() => (showing = true)}>
    <span class="avatar">
        <Avatar url={match.avatarUrl} size={AvatarSize.Default} />
    </span>
    <div class="details">
        <h4 class="bot-name">
            {match.name}
        </h4>
        <p title={match.definition.description} class="bot-desc">
            {match.definition.description}
        </p>
        <div class="commands">
            {#each match.definition.commands as command}
                <TooltipWrapper position="bottom" align="middle">
                    <div slot="target" class="command">{command.name}</div>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {align} {position}>
                            {command.description}
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
            {/each}
        </div>
    </div>
</div>

<style lang="scss">
    .bot-match {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        gap: 12px;
        cursor: pointer;

        @media (hover: hover) {
            &:hover {
                background-color: var(--members-hv);
            }
        }

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
        align-self: start;
    }

    .details {
        display: flex;
        gap: $sp2;
        flex: 1;
        flex-direction: column;
        @include font(book, normal, fs-100);

        .bot-name {
            @include ellipsis();
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            @include clamp(2);
            margin-bottom: $sp3;
        }
    }

    .commands {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: $sp3;
        .command {
            @include font(light, normal, fs-80);
            background-color: var(--button-bg);
            color: var(--button-txt);
            padding: $sp2 $sp3;
            border-radius: $sp2;
        }
    }
</style>
