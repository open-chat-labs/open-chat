<!-- A community's requirements to join as a card (communityPreview.adapter's requirementCard): each with its icon, words
     and detail, and the user's status where it's shown (a preview's: Met, On join, Not met, To do); its notes under it
     (all or any, how often members are re-checked). The preview's (N8b) and the community details' read-only Access
     gates (N8a). -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import { interpolateNewUi } from "@i18n/i18n";
    import Icon from "@openchat/ui/src/lib/components/Icon.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { _ } from "svelte-i18n";
    import type { RequirementCard } from "./communityPreview.adapter";

    type Props = { label: string; card: RequirementCard; status: boolean };

    let { label, card, status }: Props = $props();

    const text = (key: ResourceKey) => interpolateNewUi($_, key);
</script>

<SettingsGroup {label} note={card.notes.map(text).join(" ")}>
    {#each card.rows as row (row.id)}
        <div class="settings-row requirement">
            <span class="req-icon"><Icon icon={row.icon} size={19} /></span>
            <span class="texts">
                <span class="label">{text(row.label)}</span>
                {#if row.detail !== undefined}
                    <span class="detail">{text(row.detail)}</span>
                {/if}
            </span>
            {#if status}
                <span class="status" class:met={row.state === "met"} class:short={row.state === "short"}>
                    {#if row.state === "met"}<Icon icon="check" size={13} />{/if}
                    {text(row.status)}
                </span>
            {/if}
        </div>
    {/each}
</SettingsGroup>

<style lang="scss">
    .requirement {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
    }

    .req-icon {
        flex: none;
        display: flex;
        color: var(--ink-3);
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label {
        font: 500 15px/1.2 var(--font-sans);
    }

    .detail {
        font: 500 12.5px/1.3 var(--font-sans);
        color: var(--ink-4);
    }

    .status {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        font: 600 12.5px/1 var(--font-sans);
        color: var(--ink-3);

        &.met {
            color: var(--status-online);
        }

        &.short {
            color: var(--status-warning);
        }
    }
</style>
