<!-- A community in Explore's lists (Design Notes §3.8): its place in the ranking (a shelf's, View all's), the 44px
     rounded-square avatar, the name, and under it the members (people icon + "12.9k"), its language, a lock if it's
     gated and "· Joined" if the user is in it. -->
<script lang="ts">
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import { _, locale } from "svelte-i18n";
    import { compactCount, type ExploreRow } from "./explore.adapter";

    type Props = { row: ExploreRow; ranked?: boolean; onOpen: (row: ExploreRow) => void };

    let { row, ranked = false, onOpen }: Props = $props();

    const language = $derived(supportedLanguagesByCode[row.language]?.name ?? row.language);
</script>

<button type="button" class="row" onclick={() => onOpen(row)}>
    {#if ranked}<span class="rank">{row.rank}</span>{/if}
    <Avatar size={44} shape="squircle" url={row.avatarUrl} color={row.color} />
    <span class="texts">
        <span class="name">{row.name}</span>
        <span class="meta">
            <span
                class="members"
                aria-label={$_("native.explore.members", { values: { count: row.members } })}>
                <span class="users"></span>{compactCount(row.members, $locale)}
            </span>
            {#if language}<span class="language">{language}</span>{/if}
            {#if row.gated}<span class="lock"></span>{/if}
            {#if row.joined}<span class="joined">· {$_("native.explore.joined")}</span>{/if}
        </span>
    </span>
</button>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 68px;
        padding: 10px 12px;
        box-sizing: border-box;
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .rank {
        flex: none;
        width: 18px;
        font: 700 13px/1 var(--font-mono);
        color: var(--ink-4);
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .name {
        font: 700 15px/1.2 var(--font-sans);
        @include truncate;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font: 500 12.5px/1.2 var(--font-sans);
        color: var(--ink-4);
        white-space: nowrap;
        overflow: hidden;
    }

    .members {
        flex: none;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .users {
        @include icon(users, 12px);
    }

    .language {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .lock {
        @include icon(lock, 11px, var(--ink-3));
    }

    .joined {
        color: var(--status-online);
    }
</style>
