<script lang="ts">
    import { type BotMatch } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    interface Props {
        match: BotMatch;
        onClick: (match: BotMatch) => void;
        showCommands: boolean;
        installing: boolean;
    }

    let { match, onClick, showCommands, installing }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="bot-match" onclick={() => onClick(match)}>
    <span class="avatar">
        <BotAvatar bot={match} />
    </span>
    <div class="details">
        <h4 class="bot-name">
            {match.name}
            {#if installing}
                <div class="installing"></div>
            {/if}
        </h4>
        <p title={match.definition.description} class="bot-desc">
            {match.definition.description}
        </p>
        {#if showCommands}
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
        {/if}
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
