<script lang="ts">
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { type BotEventType, type ResourceKey } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        eventTypes: Set<BotEventType>;
        title?: ResourceKey;
        nested?: boolean;
    }

    let { eventTypes, title }: Props = $props();
    const allEventTypes: BotEventType[] = ["message", "membership_changed", "chat_details_updated"];
</script>

{#snippet check(label: ResourceKey, requested: boolean)}
    <div class="event" class:disabled={!requested}>
        <div class="check">
            {#if requested}
                <Check size={"1em"} color={"limegreen"} />
            {:else}
                <Minus size={"1em"} color={"var(--txt-light)"} />
            {/if}
        </div>
        <div class="label">
            <Translatable resourceKey={label}></Translatable>
        </div>
    </div>
{/snippet}

{#if title !== undefined}
    <Legend label={title}></Legend>
{/if}
{#each allEventTypes as ev}
    {@render check(i18nKey(`bots.events.${ev}`), eventTypes.has(ev))}
{/each}

<style lang="scss">
    .event {
        display: flex;
        gap: $sp3;
        align-items: center;

        &.disabled {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
        }
    }
</style>
