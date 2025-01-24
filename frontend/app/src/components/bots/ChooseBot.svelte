<script lang="ts">
    import { AvatarSize, currentUser, externalBots, type ExternalBot } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import AlertBox from "../AlertBox.svelte";
    import Avatar from "../Avatar.svelte";

    interface Props {
        onSelect: (bot: ExternalBot) => void;
        ownedOnly: boolean;
    }

    let { onSelect, ownedOnly }: Props = $props();

    let bots = $derived(
        ownedOnly
            ? [...$externalBots.values()].filter((b) => b.ownerId === $currentUser.userId)
            : [...$externalBots.values()],
    );
</script>

{#if bots.length === 0}
    <AlertBox>
        <Translatable resourceKey={i18nKey("bots.update_bot.nobots")}></Translatable>
    </AlertBox>
{:else}
    <div class="bots">
        {#each bots as bot}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={() => onSelect(bot)} class="match">
                <span class="avatar">
                    <Avatar
                        url={bot.avatarUrl ?? "/assets/bot_avatar.svg"}
                        size={AvatarSize.Default} />
                </span>
                <div class="details">
                    <h4 class="bot-name">
                        {bot.name}
                    </h4>
                    <p title={bot.definition.description} class="bot-desc">
                        {bot.definition.description}
                    </p>
                </div>
            </div>
        {/each}
    </div>
{/if}

<style lang="scss">
    .bots {
        max-height: 500px;
        overflow: auto;
    }

    .match {
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
        }
    }
</style>
